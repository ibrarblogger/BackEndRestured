import {
  KitchenTicketStatus,
  OrderStatus,
  OrderType,
  Prisma,
  StockMovementType,
  TableStatus,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { getPrismaPagination } from '../../utils/pagination';

export const orderFullInclude = {
  branch: {
    select: {
      id: true,
      name: true,
      code: true,
      currency: true,
      address: true,
      phone: true,
      receiptHeader: true,
      receiptFooter: true,
    },
  },
  table: { select: { id: true, tableNumber: true, capacity: true, status: true } },
  customer: { select: { id: true, firstName: true, lastName: true, phone: true, loyaltyPoints: true } },
  waiter: { select: { id: true, firstName: true, lastName: true, email: true } },
  cashier: { select: { id: true, firstName: true, lastName: true, email: true } },
  discount: true,
  items: {
    include: {
      modifiers: true,
    },
  },
  kitchenTickets: true,
  payments: true,
  invoice: true,
} satisfies Prisma.OrderInclude;

export class OrdersRepository {
  async findBranchById(branchId?: string) {
    if (branchId) {
      return prisma.branch.findFirst({ where: { id: branchId, deletedAt: null } });
    }
    return prisma.branch.findFirst({ where: { deletedAt: null, isActive: true } });
  }

  async findMenuItemsForOrder(branchId: string, menuItemIds: string[]) {
    return prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        branchId,
        deletedAt: null,
      },
      include: {
        variants: { where: { deletedAt: null } },
        addOns: { where: { deletedAt: null } },
        recipe: {
          include: {
            ingredients: {
              include: { ingredient: true },
            },
          },
        },
      },
    });
  }

  async findDiscountById(discountId: string, branchId: string) {
    return prisma.discount.findFirst({
      where: { id: discountId, branchId, isActive: true, deletedAt: null },
    });
  }

  async findCouponByCode(code: string, branchId: string) {
    return prisma.coupon.findFirst({
      where: {
        branchId,
        code: { equals: code, mode: 'insensitive' },
        isActive: true,
        deletedAt: null,
      },
    });
  }

  async findManyOrders(query: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    branchId?: string;
    status?: OrderStatus;
    orderType?: OrderType;
    tableId?: string;
    waiterId?: string;
    customerId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { page, limit, skip, take, orderBy } = getPrismaPagination(query);

    const where: Prisma.OrderWhereInput = { deletedAt: null };
    if (query.branchId) where.branchId = query.branchId;
    if (query.status) where.status = query.status;
    if (query.orderType) where.orderType = query.orderType;
    if (query.tableId) where.tableId = query.tableId;
    if (query.waiterId) where.waiterId = query.waiterId;
    if (query.customerId) where.customerId = query.customerId;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }
    if (query.search) {
      where.OR = [
        { orderNumber: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy,
        include: orderFullInclude,
      }),
      prisma.order.count({ where }),
    ]);

    return { items, meta: { page, limit, total } };
  }

  async findOrderById(id: string) {
    return prisma.order.findFirst({
      where: { id, deletedAt: null },
      include: orderFullInclude,
    });
  }

  async executeOrderCreationTransaction(params: {
    orderData: Prisma.OrderUncheckedCreateInput;
    resolvedItems: {
      menuItemId: string;
      variantId?: string;
      itemName: string;
      variantName?: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      notes?: string;
      station: string;
      prepTimeMinutes: number;
      modifiers: { addOnId: string; name: string; price: number; quantity: number }[];
    }[];
    ingredientDeductions: {
      ingredientId: string;
      ingredientName: string;
      deductQty: number;
      currentStock: number;
      reorderLevel: number;
      costPerUnit: number;
    }[];
    couponIdToIncrement?: string;
    holdImmediately?: boolean;
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. Create Order + OrderItems + OrderItemModifiers
      const order = await tx.order.create({
        data: {
          ...params.orderData,
          items: {
            create: params.resolvedItems.map((item) => ({
              menuItemId: item.menuItemId,
              variantId: item.variantId ?? null,
              itemName: item.itemName,
              variantName: item.variantName ?? null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
              notes: item.notes,
              status: KitchenTicketStatus.QUEUED,
              modifiers: item.modifiers.length
                ? {
                    create: item.modifiers.map((m) => ({
                      addOnId: m.addOnId,
                      name: m.name,
                      price: m.price,
                      quantity: m.quantity,
                    })),
                  }
                : undefined,
            })),
          },
        },
        include: { items: { include: { modifiers: true } } },
      });

      // 2. If DINE_IN and tableId provided, mark Table OCCUPIED
      if (order.tableId && order.orderType === OrderType.DINE_IN) {
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: TableStatus.OCCUPIED },
        });
      }

      // 3. Increment coupon usage if applied
      if (params.couponIdToIncrement) {
        await tx.coupon.update({
          where: { id: params.couponIdToIncrement },
          data: { usedCount: { increment: 1 } },
        });
      }

      // 4. Create KitchenTickets grouped by station (unless held immediately)
      const createdTickets = [];
      if (!params.holdImmediately) {
        const stationGroups = new Map<string, typeof params.resolvedItems>();
        for (const item of params.resolvedItems) {
          const list = stationGroups.get(item.station) || [];
          list.push(item);
          stationGroups.set(item.station, list);
        }

        let stationIdx = 1;
        for (const [station, stationItems] of stationGroups.entries()) {
          const maxPrep = Math.max(...stationItems.map((i) => i.prepTimeMinutes || 15));
          const ticket = await tx.kitchenTicket.create({
            data: {
              branchId: order.branchId,
              orderId: order.id,
              ticketNumber: `${order.orderNumber}-K${stationIdx++}`,
              station,
              status: KitchenTicketStatus.QUEUED,
              prepTimeTargetMin: maxPrep,
              itemsSnapshot: stationItems.map((si) => ({
                itemName: si.itemName,
                variantName: si.variantName,
                quantity: si.quantity,
                notes: si.notes,
                modifiers: si.modifiers,
              })) as unknown as Prisma.InputJsonValue,
            },
          });
          createdTickets.push(ticket);
        }
      }

      // 5. Deduct Recipe Ingredients & Record StockMovements
      const lowStockAlerts: {
        ingredientId: string;
        name: string;
        currentStock: number;
        reorderLevel: number;
      }[] = [];

      if (!params.holdImmediately && params.ingredientDeductions.length > 0) {
        for (const ded of params.ingredientDeductions) {
          const newStock = Number((ded.currentStock - ded.deductQty).toFixed(3));
          await tx.ingredient.update({
            where: { id: ded.ingredientId },
            data: { currentStock: newStock },
          });

          await tx.stockMovement.create({
            data: {
              branchId: order.branchId,
              ingredientId: ded.ingredientId,
              type: StockMovementType.SALE_DEDUCTION,
              quantity: -ded.deductQty,
              previousStock: ded.currentStock,
              newStock,
              unitCost: ded.costPerUnit,
              referenceId: order.id,
              notes: `Auto-deducted for Order ${order.orderNumber}`,
              createdBy: order.createdBy,
            },
          });

          if (newStock <= ded.reorderLevel) {
            lowStockAlerts.push({
              ingredientId: ded.ingredientId,
              name: ded.ingredientName,
              currentStock: newStock,
              reorderLevel: ded.reorderLevel,
            });
          }
        }

        await tx.order.update({
          where: { id: order.id },
          data: { stockDeducted: true },
        });
      }

      const fullOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: orderFullInclude,
      });

      return { order: fullOrder!, createdTickets, lowStockAlerts };
    });
  }

  async updateOrderStatus(id: string, status: OrderStatus, actorUserId?: string) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          status,
          heldAt: status === OrderStatus.ON_HOLD ? new Date() : undefined,
          completedAt: status === OrderStatus.PAID ? new Date() : undefined,
          updatedBy: actorUserId,
        },
        include: orderFullInclude,
      });

      if (
        (status === OrderStatus.PAID || status === OrderStatus.CANCELLED) &&
        updated.tableId
      ) {
        await tx.table.update({
          where: { id: updated.tableId },
          data: { status: TableStatus.AVAILABLE },
        });
      }

      return updated;
    });
  }

  async cancelOrder(id: string, reason: string, actorUserId?: string) {
    return prisma.$transaction(async (tx) => {
      await tx.kitchenTicket.updateMany({
        where: { orderId: id },
        data: { status: KitchenTicketStatus.CANCELLED },
      });

      await tx.orderItem.updateMany({
        where: { orderId: id },
        data: { status: KitchenTicketStatus.CANCELLED },
      });

      const updated = await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: reason,
          updatedBy: actorUserId,
        },
        include: orderFullInclude,
      });

      if (updated.tableId) {
        await tx.table.update({
          where: { id: updated.tableId },
          data: { status: TableStatus.AVAILABLE },
        });
      }

      return updated;
    });
  }

  async upsertInvoice(orderId: string, invoiceNumber: string, pdfUrl?: string) {
    return prisma.invoice.upsert({
      where: { orderId },
      update: { pdfUrl },
      create: {
        orderId,
        invoiceNumber,
        pdfUrl,
      },
    });
  }
}

export const ordersRepository = new OrdersRepository();

