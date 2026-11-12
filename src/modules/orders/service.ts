import { OrderStatus, OrderType } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { formatCurrencyAmount, getCurrencyDetails } from '../../constants/currencies';
import { ConflictError, NotFoundError, ValidationError } from '../../errors';
import { prisma } from '../../config/prisma';
import { emitSocketEvent, SOCKET_EVENTS } from '../../sockets';
import { auditService } from '../audit/service';
import { orderFullInclude, ordersRepository } from './repository';
import {
  BillingCalculationInput,
  BillingCalculationResult,
  CreateOrderInput,
  MergeOrdersInput,
  OrderItemInput,
  SplitOrderInput,
  UpdateOrderInput,
} from './types';

const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.NEW]: [
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.ON_HOLD,
    OrderStatus.CANCELLED,
    OrderStatus.PAID,
  ],
  [OrderStatus.ON_HOLD]: [
    OrderStatus.NEW,
    OrderStatus.PREPARING,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PREPARING]: [
    OrderStatus.READY,
    OrderStatus.SERVED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.READY]: [OrderStatus.SERVED, OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.SERVED]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [],
  [OrderStatus.CANCELLED]: [],
};

/**
 * Pure, deterministic billing calculation function for POS orders (unit-tested).
 */
export function calculateOrderTotals(
  input: BillingCalculationInput
): BillingCalculationResult {
  const subtotal = Number(Math.max(0, input.subtotal).toFixed(2));

  let discountAmount = 0;
  if (
    input.discountType &&
    input.discountValue &&
    input.discountValue > 0 &&
    subtotal >= (input.minOrderAmount ?? 0)
  ) {
    if (input.discountType === 'PERCENTAGE') {
      discountAmount = Number(((subtotal * input.discountValue) / 100).toFixed(2));
    } else {
      discountAmount = Number(Math.min(subtotal, input.discountValue).toFixed(2));
    }

    if (input.maxDiscount && discountAmount > input.maxDiscount) {
      discountAmount = Number(input.maxDiscount.toFixed(2));
    }
  }

  const taxableAmount = Number(Math.max(0, subtotal - discountAmount).toFixed(2));
  const taxAmount = Number(
    ((taxableAmount * Math.max(0, input.taxRatePercent)) / 100).toFixed(2)
  );

  const serviceCharge =
    input.orderType === OrderType.DINE_IN
      ? Number(
          ((taxableAmount * Math.max(0, input.serviceChargePercent)) / 100).toFixed(2)
        )
      : 0;

  const deliveryFee =
    input.orderType === OrderType.DELIVERY
      ? Number(Math.max(0, input.deliveryFee ?? 0).toFixed(2))
      : 0;

  const tipAmount = Number(Math.max(0, input.tipAmount ?? 0).toFixed(2));

  const totalAmount = Number(
    (taxableAmount + taxAmount + serviceCharge + deliveryFee + tipAmount).toFixed(2)
  );

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    serviceCharge,
    deliveryFee,
    tipAmount,
    totalAmount,
  };
}

export class OrdersService {
  private generateOrderNumber(prefix = 'ORD'): string {
    const now = new Date();
    const datePart = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(
      2,
      '0'
    )}${String(now.getUTCDate()).padStart(2, '0')}`;
    const randPart = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}-${datePart}-${randPart}`;
  }

  private async resolveOrderItemsAndRecipes(branchId: string, items: OrderItemInput[]) {
    const menuItemIds = [...new Set(items.map((i) => i.menuItemId))];
    const dbItems = await ordersRepository.findMenuItemsForOrder(branchId, menuItemIds);
    const itemMap = new Map(dbItems.map((m) => [m.id, m]));

    const resolvedItems = [];
    const deductionMap = new Map<
      string,
      {
        ingredientId: string;
        ingredientName: string;
        deductQty: number;
        currentStock: number;
        reorderLevel: number;
        costPerUnit: number;
      }
    >();

    for (const reqItem of items) {
      const menuItem = itemMap.get(reqItem.menuItemId);
      if (!menuItem) {
        throw new NotFoundError(`Menu item (${reqItem.menuItemId})`);
      }
      if (!menuItem.isAvailable) {
        throw new ValidationError(`Menu item "${menuItem.name}" is currently unavailable`);
      }

      let unitPrice = Number(menuItem.price);
      let variantName: string | undefined;

      if (reqItem.variantId) {
        const variant = menuItem.variants.find((v) => v.id === reqItem.variantId);
        if (!variant || !variant.isAvailable) {
          throw new ValidationError(`Selected variant for "${menuItem.name}" is invalid or unavailable`);
        }
        unitPrice += Number(variant.priceDelta);
        variantName = variant.name;
      }

      const resolvedModifiers = [];
      let modifiersUnitTotal = 0;
      if (reqItem.modifiers?.length) {
        for (const modReq of reqItem.modifiers) {
          const addOn = menuItem.addOns.find((a) => a.id === modReq.addOnId);
          if (!addOn || !addOn.isAvailable) {
            throw new ValidationError(`Selected add-on for "${menuItem.name}" is invalid or unavailable`);
          }
          const modQty = modReq.quantity ?? 1;
          const modPrice = Number(addOn.price);
          modifiersUnitTotal += modPrice * modQty;
          resolvedModifiers.push({
            addOnId: addOn.id,
            name: addOn.name,
            price: modPrice,
            quantity: modQty,
          });
        }
      }

      const effectiveUnitPrice = Number((unitPrice + modifiersUnitTotal).toFixed(2));
      const lineSubtotal = Number((effectiveUnitPrice * reqItem.quantity).toFixed(2));

      resolvedItems.push({
        menuItemId: menuItem.id,
        variantId: reqItem.variantId,
        itemName: menuItem.name,
        variantName,
        quantity: reqItem.quantity,
        unitPrice: effectiveUnitPrice,
        subtotal: lineSubtotal,
        notes: reqItem.notes,
        station: menuItem.station || 'MAIN_KITCHEN',
        prepTimeMinutes: menuItem.prepTimeMinutes || 15,
        modifiers: resolvedModifiers,
      });

      // Accumulate recipe ingredient deductions
      if (menuItem.recipe?.ingredients?.length) {
        const yieldQty = Math.max(1, menuItem.recipe.yieldQty || 1);
        for (const ri of menuItem.recipe.ingredients) {
          const needed = (Number(ri.quantity) / yieldQty) * reqItem.quantity;
          const existing = deductionMap.get(ri.ingredientId);
          if (existing) {
            existing.deductQty += needed;
          } else {
            deductionMap.set(ri.ingredientId, {
              ingredientId: ri.ingredient.id,
              ingredientName: ri.ingredient.name,
              deductQty: needed,
              currentStock: Number(ri.ingredient.currentStock),
              reorderLevel: Number(ri.ingredient.reorderLevel),
              costPerUnit: Number(ri.ingredient.costPerUnit),
            });
          }
        }
      }
    }

    return {
      resolvedItems,
      ingredientDeductions: Array.from(deductionMap.values()),
    };
  }

  async listOrders(query: any) {
    return ordersRepository.findManyOrders(query);
  }

  async getOrderById(id: string) {
    const order = await ordersRepository.findOrderById(id);
    if (!order) throw new NotFoundError('Order');
    return order;
  }

  async createOrder(input: CreateOrderInput) {
    const branch = await ordersRepository.findBranchById(input.branchId);
    if (!branch) {
      throw new NotFoundError('Branch');
    }

    if (input.orderType === OrderType.DINE_IN && !input.tableId) {
      throw new ValidationError('tableId is required for DINE_IN orders');
    }

    const { resolvedItems, ingredientDeductions } = await this.resolveOrderItemsAndRecipes(
      branch.id,
      input.items
    );

    const rawSubtotal = resolvedItems.reduce((acc, item) => acc + item.subtotal, 0);

    // Resolve Discount or Coupon if provided
    let discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | null = null;
    let discountValue = 0;
    let minOrderAmount = 0;
    let maxDiscount: number | null = null;
    let couponIdToIncrement: string | undefined;

    if (input.discountId) {
      const discount = await ordersRepository.findDiscountById(input.discountId, branch.id);
      if (!discount) throw new NotFoundError('Discount');
      discountType = discount.type;
      discountValue = Number(discount.value);
      minOrderAmount = Number(discount.minOrderAmount);
      maxDiscount = discount.maxDiscount ? Number(discount.maxDiscount) : null;
    } else if (input.couponCode) {
      const coupon = await ordersRepository.findCouponByCode(input.couponCode, branch.id);
      if (!coupon) throw new ValidationError(`Invalid or inactive coupon code "${input.couponCode}"`);
      const now = new Date();
      if (coupon.startsAt && coupon.startsAt > now) {
        throw new ValidationError('Coupon is not yet active');
      }
      if (coupon.expiresAt && coupon.expiresAt < now) {
        throw new ValidationError('Coupon has expired');
      }
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        throw new ValidationError('Coupon usage limit has been reached');
      }
      discountType = coupon.type;
      discountValue = Number(coupon.value);
      minOrderAmount = Number(coupon.minOrderAmount);
      maxDiscount = coupon.maxDiscount ? Number(coupon.maxDiscount) : null;
      couponIdToIncrement = coupon.id;
    }

    const totals = calculateOrderTotals({
      subtotal: rawSubtotal,
      orderType: input.orderType,
      taxRatePercent: Number(branch.taxRatePercent),
      serviceChargePercent: Number(branch.serviceChargePercent),
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscount,
      deliveryFee: input.deliveryFee,
      tipAmount: input.tipAmount,
    });

    const orderNumber = this.generateOrderNumber(branch.orderNumberPrefix || 'ORD');

    const { order, createdTickets, lowStockAlerts } =
      await ordersRepository.executeOrderCreationTransaction({
        orderData: {
          branchId: branch.id,
          orderNumber,
          tableId: input.tableId ?? null,
          customerId: input.customerId ?? null,
          waiterId: input.waiterId ?? input.actorUserId ?? null,
          orderType: input.orderType,
          status: input.holdImmediately ? OrderStatus.ON_HOLD : OrderStatus.NEW,
          guestCount: input.guestCount ?? 1,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxAmount: totals.taxAmount,
          serviceCharge: totals.serviceCharge,
          deliveryFee: totals.deliveryFee,
          tipAmount: totals.tipAmount,
          totalAmount: totals.totalAmount,
          couponCode: input.couponCode ?? null,
          discountId: input.discountId ?? null,
          notes: input.notes,
          heldAt: input.holdImmediately ? new Date() : null,
          createdBy: input.actorUserId,
        },
        resolvedItems,
        ingredientDeductions,
        couponIdToIncrement,
        holdImmediately: input.holdImmediately,
      });

    // Emit Real-Time Socket.io Events
    emitSocketEvent(SOCKET_EVENTS.ORDER_CREATED, order, { branchId: branch.id });

    for (const ticket of createdTickets) {
      emitSocketEvent(SOCKET_EVENTS.KITCHEN_TICKET_NEW, ticket, {
        branchId: branch.id,
        station: ticket.station,
      });
    }

    for (const alert of lowStockAlerts) {
      emitSocketEvent(SOCKET_EVENTS.STOCK_LOW, alert, { branchId: branch.id });
    }

    return order;
  }

  async updateOrder(id: string, input: UpdateOrderInput) {
    const existing = await this.getOrderById(id);
    if (
      existing.status === OrderStatus.PAID ||
      existing.status === OrderStatus.CANCELLED
    ) {
      throw new ConflictError(`Cannot modify an order with status ${existing.status}`);
    }

    const branch = await ordersRepository.findBranchById(existing.branchId);
    if (!branch) throw new NotFoundError('Branch');

    const updatedOrder = await prisma.$transaction(async (tx) => {
      let newSubtotal = Number(existing.subtotal);

      if (input.items?.length) {
        const { resolvedItems } = await this.resolveOrderItemsAndRecipes(
          existing.branchId,
          input.items
        );
        await tx.orderItem.deleteMany({ where: { orderId: id } });

        for (const item of resolvedItems) {
          await tx.orderItem.create({
            data: {
              orderId: id,
              menuItemId: item.menuItemId,
              variantId: item.variantId ?? null,
              itemName: item.itemName,
              variantName: item.variantName ?? null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
              notes: item.notes,
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
            },
          });
        }

        newSubtotal = resolvedItems.reduce((sum, i) => sum + i.subtotal, 0);
      }

      const totals = calculateOrderTotals({
        subtotal: newSubtotal,
        orderType: existing.orderType,
        taxRatePercent: Number(branch.taxRatePercent),
        serviceChargePercent: Number(branch.serviceChargePercent),
        deliveryFee:
          input.deliveryFee !== undefined
            ? input.deliveryFee
            : Number(existing.deliveryFee),
        tipAmount:
          input.tipAmount !== undefined ? input.tipAmount : Number(existing.tipAmount),
      });

      return tx.order.update({
        where: { id },
        data: {
          tableId: input.tableId !== undefined ? input.tableId : undefined,
          customerId: input.customerId !== undefined ? input.customerId : undefined,
          guestCount: input.guestCount,
          notes: input.notes,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxAmount: totals.taxAmount,
          serviceCharge: totals.serviceCharge,
          deliveryFee: totals.deliveryFee,
          tipAmount: totals.tipAmount,
          totalAmount: totals.totalAmount,
          updatedBy: input.actorUserId,
        },
        include: orderFullInclude,
      });
    });

    emitSocketEvent(SOCKET_EVENTS.ORDER_UPDATED, updatedOrder, {
      branchId: existing.branchId,
    });

    return updatedOrder;
  }

  async transitionStatus(id: string, targetStatus: OrderStatus, actorUserId?: string) {
    const existing = await this.getOrderById(id);
    if (existing.status === targetStatus) return existing;

    const allowed = ALLOWED_STATUS_TRANSITIONS[existing.status] || [];
    if (!allowed.includes(targetStatus)) {
      throw new ValidationError(
        `Invalid order status transition from ${existing.status} to ${targetStatus}`
      );
    }

    const updated = await ordersRepository.updateOrderStatus(id, targetStatus, actorUserId);

    emitSocketEvent(
      SOCKET_EVENTS.ORDER_STATUS_CHANGED,
      {
        orderId: updated.id,
        orderNumber: updated.orderNumber,
        previousStatus: existing.status,
        status: updated.status,
      },
      { branchId: updated.branchId }
    );

    return updated;
  }

  async holdOrder(id: string, actorUserId?: string) {
    return this.transitionStatus(id, OrderStatus.ON_HOLD, actorUserId);
  }

  async resumeOrder(id: string, actorUserId?: string) {
    const existing = await this.getOrderById(id);
    if (existing.status !== OrderStatus.ON_HOLD) {
      throw new ValidationError('Only orders with status ON_HOLD can be resumed');
    }
    return this.transitionStatus(id, OrderStatus.PREPARING, actorUserId);
  }

  async cancelOrder(id: string, reason: string, actorUserId?: string) {
    const existing = await this.getOrderById(id);
    if (existing.status === OrderStatus.PAID) {
      throw new ConflictError('Paid orders cannot be cancelled directly; issue a refund instead.');
    }

    const cancelled = await ordersRepository.cancelOrder(id, reason, actorUserId);

    await auditService.log({
      branchId: existing.branchId,
      userId: actorUserId,
      action: 'ORDER_CANCELLED',
      entity: 'Order',
      entityId: id,
      oldValues: { status: existing.status, totalAmount: Number(existing.totalAmount) },
      newValues: { status: OrderStatus.CANCELLED, reason },
    });

    emitSocketEvent(
      SOCKET_EVENTS.ORDER_STATUS_CHANGED,
      {
        orderId: cancelled.id,
        orderNumber: cancelled.orderNumber,
        previousStatus: existing.status,
        status: OrderStatus.CANCELLED,
      },
      { branchId: cancelled.branchId }
    );

    return cancelled;
  }

  /**
   * Splits selected OrderItem IDs from an existing Order into a new child Order inside a Prisma transaction.
   */
  async splitOrder(orderId: string, input: SplitOrderInput) {
    const parentOrder = await this.getOrderById(orderId);
    if (
      parentOrder.status === OrderStatus.PAID ||
      parentOrder.status === OrderStatus.CANCELLED
    ) {
      throw new ConflictError(`Cannot split an order with status ${parentOrder.status}`);
    }

    const itemsToMove = parentOrder.items.filter((i) =>
      input.orderItemIds.includes(i.id)
    );
    if (itemsToMove.length === 0) {
      throw new ValidationError('None of the specified orderItemIds belong to this order');
    }
    if (itemsToMove.length === parentOrder.items.length) {
      throw new ValidationError('Cannot move all items when splitting; at least one item must remain on the original order');
    }

    const branch = await ordersRepository.findBranchById(parentOrder.branchId);
    if (!branch) throw new NotFoundError('Branch');

    const result = await prisma.$transaction(async (tx) => {
      const childOrderNumber = `${parentOrder.orderNumber}-S${Math.floor(10 + Math.random() * 89)}`;
      const childSubtotal = itemsToMove.reduce((s, i) => s + Number(i.subtotal), 0);
      const childTotals = calculateOrderTotals({
        subtotal: childSubtotal,
        orderType: parentOrder.orderType,
        taxRatePercent: Number(branch.taxRatePercent),
        serviceChargePercent: Number(branch.serviceChargePercent),
      });

      const childOrder = await tx.order.create({
        data: {
          branchId: parentOrder.branchId,
          orderNumber: childOrderNumber,
          parentOrderId: parentOrder.id,
          tableId: parentOrder.tableId,
          customerId: parentOrder.customerId,
          waiterId: parentOrder.waiterId,
          orderType: parentOrder.orderType,
          status: parentOrder.status,
          guestCount: input.guestCount ?? 1,
          subtotal: childTotals.subtotal,
          taxAmount: childTotals.taxAmount,
          serviceCharge: childTotals.serviceCharge,
          totalAmount: childTotals.totalAmount,
          createdBy: input.actorUserId,
        },
      });

      // Reassign selected items to the new child order
      await tx.orderItem.updateMany({
        where: { id: { in: itemsToMove.map((i) => i.id) } },
        data: { orderId: childOrder.id },
      });

      // Recalculate parent order totals
      const remainingItems = parentOrder.items.filter(
        (i) => !input.orderItemIds.includes(i.id)
      );
      const parentSubtotal = remainingItems.reduce((s, i) => s + Number(i.subtotal), 0);
      const parentTotals = calculateOrderTotals({
        subtotal: parentSubtotal,
        orderType: parentOrder.orderType,
        taxRatePercent: Number(branch.taxRatePercent),
        serviceChargePercent: Number(branch.serviceChargePercent),
      });

      const updatedParent = await tx.order.update({
        where: { id: parentOrder.id },
        data: {
          subtotal: parentTotals.subtotal,
          taxAmount: parentTotals.taxAmount,
          serviceCharge: parentTotals.serviceCharge,
          totalAmount: parentTotals.totalAmount,
          updatedBy: input.actorUserId,
        },
        include: orderFullInclude,
      });

      const fullChild = await tx.order.findUnique({
        where: { id: childOrder.id },
        include: orderFullInclude,
      });

      return { parentOrder: updatedParent, splitOrder: fullChild };
    });

    return result;
  }

  /**
   * Merges items from sourceOrderIds into targetOrderId inside a Prisma transaction.
   */
  async mergeOrders(input: MergeOrdersInput) {
    const targetOrder = await this.getOrderById(input.targetOrderId);
    const branch = await ordersRepository.findBranchById(targetOrder.branchId);
    if (!branch) throw new NotFoundError('Branch');

    const merged = await prisma.$transaction(async (tx) => {
      await tx.orderItem.updateMany({
        where: { orderId: { in: input.sourceOrderIds } },
        data: { orderId: targetOrder.id },
      });

      await tx.kitchenTicket.updateMany({
        where: { orderId: { in: input.sourceOrderIds } },
        data: { orderId: targetOrder.id },
      });

      await tx.order.updateMany({
        where: { id: { in: input.sourceOrderIds } },
        data: {
          status: OrderStatus.CANCELLED,
          cancelReason: `Merged into Order ${targetOrder.orderNumber}`,
          updatedBy: input.actorUserId,
        },
      });

      const allItems = await tx.orderItem.findMany({
        where: { orderId: targetOrder.id },
      });

      const newSubtotal = allItems.reduce((s, i) => s + Number(i.subtotal), 0);
      const totals = calculateOrderTotals({
        subtotal: newSubtotal,
        orderType: targetOrder.orderType,
        taxRatePercent: Number(branch.taxRatePercent),
        serviceChargePercent: Number(branch.serviceChargePercent),
        deliveryFee: Number(targetOrder.deliveryFee),
        tipAmount: Number(targetOrder.tipAmount),
      });

      return tx.order.update({
        where: { id: targetOrder.id },
        data: {
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          serviceCharge: totals.serviceCharge,
          totalAmount: totals.totalAmount,
          updatedBy: input.actorUserId,
        },
        include: orderFullInclude,
      });
    });

    emitSocketEvent(SOCKET_EVENTS.ORDER_UPDATED, merged, {
      branchId: targetOrder.branchId,
    });

    return merged;
  }

  /**
   * Generates a formatted PDF Invoice/Receipt for an Order using PDFKit and records the Invoice in Prisma.
   */
  async generateInvoicePdfBuffer(orderId: string): Promise<{ buffer: Buffer; invoiceNumber: string }> {
    const order = await this.getOrderById(orderId);
    const invoiceNumber = `INV-${order.orderNumber}`;

    await ordersRepository.upsertInvoice(order.id, invoiceNumber);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), invoiceNumber }));
      doc.on('error', reject);

      // Header
      doc.fontSize(18).text(order.branch.name, { align: 'center' });
      if (order.branch.receiptHeader) {
        doc.fontSize(10).text(order.branch.receiptHeader, { align: 'center' });
      }
      doc.fontSize(10).text(order.branch.address, { align: 'center' });
      doc.text(`Tel: ${order.branch.phone}`, { align: 'center' });
      doc.moveDown();

      doc.fontSize(14).text(`INVOICE: ${invoiceNumber}`, { align: 'left' });
      doc.fontSize(10).text(`Order Number: ${order.orderNumber}`);
      doc.text(`Order Type: ${order.orderType}`);
      if (order.table) {
        doc.text(`Table: ${order.table.tableNumber}`);
      }
      doc.text(`Date: ${new Date(order.createdAt).toISOString()}`);
      doc.moveDown();

      // Line Items Header
      doc.fontSize(11).text('Item', 40, doc.y, { continued: true });
      doc.text('Qty', 300, doc.y, { continued: true });
      doc.text('Unit Price', 360, doc.y, { continued: true });
      doc.text('Subtotal', 450, doc.y);
      doc.moveTo(40, doc.y + 4).lineTo(550, doc.y + 4).stroke();
      doc.moveDown(0.5);

      const currCode = order.branch.currency;
      const currInfo = getCurrencyDetails(currCode);
      const fmt = (val: unknown) => formatCurrencyAmount(Number(val ?? 0), currCode);

      for (const item of order.items) {
        const label = item.variantName
          ? `${item.itemName} (${item.variantName})`
          : item.itemName;
        doc.fontSize(10).text(label, 40, doc.y, { continued: true });
        doc.text(String(item.quantity), 300, doc.y, { continued: true });
        doc.text(fmt(item.unitPrice), 360, doc.y, {
          continued: true,
        });
        doc.text(fmt(item.subtotal), 450, doc.y);
      }

      doc.moveDown();
      doc.moveTo(40, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);

      // Summary Totals
      doc.fontSize(9).text(`Currency: ${currInfo.code} (${currInfo.name})`, { align: 'right' });
      doc.fontSize(10).text(`Subtotal: ${fmt(order.subtotal)}`, { align: 'right' });
      if (Number(order.discountAmount) > 0) {
        doc.text(`Discount: -${fmt(order.discountAmount)}`, { align: 'right' });
      }
      doc.text(`Tax: ${fmt(order.taxAmount)}`, { align: 'right' });
      if (Number(order.serviceCharge) > 0) {
        doc.text(`Service Charge: ${fmt(order.serviceCharge)}`, {
          align: 'right',
        });
      }
      if (Number(order.deliveryFee) > 0) {
        doc.text(`Delivery Fee: ${fmt(order.deliveryFee)}`, { align: 'right' });
      }
      if (Number(order.tipAmount) > 0) {
        doc.text(`Tip: ${fmt(order.tipAmount)}`, { align: 'right' });
      }
      doc.fontSize(13).text(`TOTAL: ${fmt(order.totalAmount)}`, {
        align: 'right',
      });

      doc.moveDown(2);
      if (order.branch.receiptFooter) {
        doc.fontSize(10).text(order.branch.receiptFooter, { align: 'center' });
      }

      doc.end();
    });
  }
}

export const ordersService = new OrdersService();

