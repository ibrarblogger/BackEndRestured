import {
  Prisma,
  PurchaseOrderStatus,
  StockMovementType,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { getPrismaPagination } from '../../utils/pagination';
import {
  CreatePurchaseOrderInput,
  CreateSupplierInput,
  CreateSupplierPaymentInput,
  ReceiveGoodsInput,
  UpdateSupplierInput,
} from './types';

export class SuppliersRepository {
  async findDefaultBranchId(): Promise<string | undefined> {
    const branch = await prisma.branch.findFirst({
      where: { deletedAt: null, isActive: true },
      select: { id: true },
    });
    return branch?.id;
  }

  // Suppliers CRUD
  async findManySuppliers(query: {
    page?: number;
    limit?: number;
    branchId?: string;
    search?: string;
    isActive?: boolean;
  }) {
    const { skip, take, page, limit } = getPrismaPagination(query);

    const where: Prisma.SupplierWhereInput = {
      deletedAt: null,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { contactPerson: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { purchaseOrders: true, payments: true },
          },
        },
      }),
      prisma.supplier.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findSupplierById(id: string) {
    return prisma.supplier.findFirst({
      where: { id, deletedAt: null },
      include: {
        purchaseOrders: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        payments: {
          orderBy: { paidAt: 'desc' },
          take: 20,
        },
      },
    });
  }

  async createSupplier(input: CreateSupplierInput & { branchId: string }) {
    return prisma.supplier.create({
      data: {
        branchId: input.branchId,
        name: input.name,
        contactPerson: input.contactPerson,
        phone: input.phone,
        email: input.email,
        address: input.address,
        taxId: input.taxId,
        isActive: input.isActive ?? true,
        createdBy: input.actorUserId,
        updatedBy: input.actorUserId,
      },
    });
  }

  async updateSupplier(id: string, input: UpdateSupplierInput) {
    return prisma.supplier.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.contactPerson !== undefined
          ? { contactPerson: input.contactPerson }
          : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.taxId !== undefined ? { taxId: input.taxId } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedBy: input.actorUserId,
      },
    });
  }

  async softDeleteSupplier(id: string, actorUserId?: string) {
    return prisma.supplier.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        updatedBy: actorUserId,
      },
    });
  }

  // Purchase Orders
  async findManyPurchaseOrders(query: {
    page?: number;
    limit?: number;
    branchId?: string;
    supplierId?: string;
    status?: PurchaseOrderStatus;
  }) {
    const { skip, take, page, limit } = getPrismaPagination(query);

    const where: Prisma.PurchaseOrderWhereInput = {
      deletedAt: null,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: {
            select: { id: true, name: true, phone: true, contactPerson: true },
          },
          items: {
            include: {
              ingredient: {
                select: { id: true, sku: true, name: true, unit: true },
              },
            },
          },
          goodsReceipts: true,
        },
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findPurchaseOrderById(id: string) {
    return prisma.purchaseOrder.findFirst({
      where: { id, deletedAt: null },
      include: {
        supplier: true,
        items: {
          include: {
            ingredient: true,
          },
        },
        goodsReceipts: {
          orderBy: { receivedAt: 'desc' },
        },
      },
    });
  }

  async createPurchaseOrder(
    input: CreatePurchaseOrderInput & {
      branchId: string;
      poNumber: string;
      totalAmount: number;
    }
  ) {
    return prisma.purchaseOrder.create({
      data: {
        branchId: input.branchId,
        supplierId: input.supplierId,
        poNumber: input.poNumber,
        status: input.status ?? PurchaseOrderStatus.ORDERED,
        totalAmount: input.totalAmount,
        expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
        notes: input.notes,
        createdBy: input.actorUserId,
        updatedBy: input.actorUserId,
        items: {
          create: input.items.map((item) => ({
            ingredientId: item.ingredientId,
            orderedQty: item.orderedQty,
            unitCost: item.unitCost,
            subtotal: Number((item.orderedQty * item.unitCost).toFixed(2)),
          })),
        },
      },
      include: {
        supplier: true,
        items: {
          include: {
            ingredient: {
              select: { id: true, sku: true, name: true, unit: true },
            },
          },
        },
      },
    });
  }

  async updatePurchaseOrderStatus(
    id: string,
    status: PurchaseOrderStatus,
    actorUserId?: string
  ) {
    return prisma.purchaseOrder.update({
      where: { id },
      data: {
        status,
        updatedBy: actorUserId,
      },
    });
  }

  // Goods Receipt Note (GRN) — Transactional Stock Increment + PO Status + Supplier Balance
  async executeGoodsReceiptTransaction(
    input: ReceiveGoodsInput & { grnNumber: string }
  ) {
    return prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUniqueOrThrow({
        where: { id: input.purchaseOrderId },
        include: { items: true },
      });

      const poItemMap = new Map(po.items.map((i) => [i.ingredientId, i]));
      let totalReceivedValue = 0;

      for (const recItem of input.items) {
        const poItem = poItemMap.get(recItem.ingredientId);
        const unitCost =
          recItem.unitCost ?? (poItem ? Number(poItem.unitCost) : 0);
        totalReceivedValue += Number((recItem.receivedQty * unitCost).toFixed(2));

        if (poItem) {
          await tx.purchaseOrderItem.update({
            where: { id: poItem.id },
            data: {
              receivedQty: { increment: recItem.receivedQty },
            },
          });
        }

        const ingredient = await tx.ingredient.findUniqueOrThrow({
          where: { id: recItem.ingredientId },
        });
        const previousStock = Number(ingredient.currentStock);
        const newStock = Number((previousStock + recItem.receivedQty).toFixed(3));

        await tx.ingredient.update({
          where: { id: ingredient.id },
          data: {
            currentStock: newStock,
            ...(unitCost > 0 ? { costPerUnit: unitCost } : {}),
            ...(recItem.expiryDate
              ? { expiryDate: new Date(recItem.expiryDate) }
              : {}),
            updatedBy: input.actorUserId,
          },
        });

        await tx.stockMovement.create({
          data: {
            branchId: po.branchId,
            ingredientId: ingredient.id,
            type: StockMovementType.PURCHASE,
            quantity: recItem.receivedQty,
            previousStock,
            newStock,
            unitCost,
            referenceId: po.id,
            notes: `Goods Receipt ${input.grnNumber} (PO ${po.poNumber})`,
            createdBy: input.actorUserId,
          },
        });
      }

      const grn = await tx.goodsReceipt.create({
        data: {
          purchaseOrderId: po.id,
          grnNumber: input.grnNumber,
          receivedBy: input.actorUserId,
          itemsReceived: input.items as unknown as Prisma.InputJsonValue,
          notes: input.notes,
        },
      });

      const refreshedPoItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: po.id },
      });

      const allFullyReceived = refreshedPoItems.every(
        (item) => Number(item.receivedQty) >= Number(item.orderedQty)
      );

      const newPoStatus = allFullyReceived
        ? PurchaseOrderStatus.RECEIVED
        : PurchaseOrderStatus.PARTIALLY_RECEIVED;

      const updatedPo = await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: newPoStatus,
          updatedBy: input.actorUserId,
        },
        include: {
          supplier: true,
          items: { include: { ingredient: true } },
          goodsReceipts: true,
        },
      });

      if (totalReceivedValue > 0) {
        await tx.supplier.update({
          where: { id: po.supplierId },
          data: {
            balanceDue: { increment: Number(totalReceivedValue.toFixed(2)) },
            updatedBy: input.actorUserId,
          },
        });
      }

      return { goodsReceipt: grn, purchaseOrder: updatedPo, totalReceivedValue };
    });
  }

  async findManyGoodsReceipts(branchId?: string, page = 1, limit = 20) {
    const { skip, take } = getPrismaPagination({ page, limit });
    const where: Prisma.GoodsReceiptWhereInput = branchId
      ? { purchaseOrder: { branchId } }
      : {};

    const [items, total] = await Promise.all([
      prisma.goodsReceipt.findMany({
        where,
        skip,
        take,
        orderBy: { receivedAt: 'desc' },
        include: {
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              status: true,
              supplier: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.goodsReceipt.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // Supplier Payments & Ledger
  async executeSupplierPaymentTransaction(
    input: CreateSupplierPaymentInput & { branchId: string }
  ) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.supplierPayment.create({
        data: {
          branchId: input.branchId,
          supplierId: input.supplierId,
          purchaseOrderId: input.purchaseOrderId ?? null,
          amount: input.amount,
          method: input.method,
          referenceNo: input.referenceNo,
          notes: input.notes,
          createdBy: input.actorUserId,
        },
        include: {
          supplier: true,
        },
      });

      const updatedSupplier = await tx.supplier.update({
        where: { id: input.supplierId },
        data: {
          balanceDue: { decrement: input.amount },
          updatedBy: input.actorUserId,
        },
      });

      if (input.purchaseOrderId) {
        await tx.purchaseOrder.update({
          where: { id: input.purchaseOrderId },
          data: {
            paidAmount: { increment: input.amount },
            updatedBy: input.actorUserId,
          },
        });
      }

      return { payment, supplier: updatedSupplier };
    });
  }

  async getSupplierLedger(supplierId: string) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, deletedAt: null },
      include: {
        purchaseOrders: {
          where: { deletedAt: null },
          include: { goodsReceipts: true },
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          orderBy: { paidAt: 'desc' },
        },
      },
    });
    return supplier;
  }
}

export const suppliersRepository = new SuppliersRepository();

