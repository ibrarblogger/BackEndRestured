import { OrderStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';

export class ReportsRepository {
  async findDefaultBranchId(): Promise<string | undefined> {
    const branch = await prisma.branch.findFirst({
      where: { deletedAt: null, isActive: true },
      select: { id: true },
    });
    return branch?.id;
  }

  async findBranchCurrency(branchId: string): Promise<string> {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { currency: true },
    });
    return branch?.currency ?? 'PKR';
  }

  async findOrderItemsForSalesReport(branchId: string, start: Date, end: Date) {
    return prisma.orderItem.findMany({
      where: {
        order: {
          branchId,
          deletedAt: null,
          status: { not: OrderStatus.CANCELLED },
          createdAt: { gte: start, lte: end },
        },
      },
      select: {
        menuItemId: true,
        itemName: true,
        quantity: true,
        unitPrice: true,
        subtotal: true,
        orderId: true,
        menuItem: {
          select: {
            id: true,
            sku: true,
            categoryId: true,
            category: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });
  }

  async findOrdersWithStaff(branchId: string, start: Date, end: Date) {
    return prisma.order.findMany({
      where: {
        branchId,
        deletedAt: null,
        status: { not: OrderStatus.CANCELLED },
        createdAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        orderNumber: true,
        waiterId: true,
        cashierId: true,
        totalAmount: true,
        tipAmount: true,
        taxAmount: true,
        discountAmount: true,
        couponCode: true,
        createdAt: true,
        waiter: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        cashier: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        discount: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findCompletedPayments(branchId: string, start: Date, end: Date) {
    return prisma.payment.findMany({
      where: {
        branchId,
        status: PaymentStatus.COMPLETED,
        paidAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        method: true,
        amount: true,
        tipAmount: true,
        paidAt: true,
      },
    });
  }

  async findActiveIngredients(branchId: string) {
    return prisma.ingredient.findMany({
      where: {
        branchId,
        deletedAt: null,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findWastageLogs(branchId: string, start: Date, end: Date) {
    return prisma.wastageLog.findMany({
      where: {
        branchId,
        createdAt: { gte: start, lte: end },
      },
      include: {
        ingredient: {
          select: { id: true, sku: true, name: true, unit: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findCustomersForRetention(branchId: string) {
    return prisma.customer.findMany({
      where: {
        branchId,
        deletedAt: null,
      },
      orderBy: { totalSpent: 'desc' },
    });
  }

  async findCoupons(branchId: string) {
    return prisma.coupon.findMany({
      where: {
        branchId,
        deletedAt: null,
      },
      orderBy: { usedCount: 'desc' },
    });
  }
}

export const reportsRepository = new ReportsRepository();

