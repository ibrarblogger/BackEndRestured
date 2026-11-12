import {
  CashDrawerStatus,
  LoyaltyTxType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  TableStatus,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { getPrismaPagination } from '../../utils/pagination';
import {
  CloseCashDrawerInput,
  CreateDiscountInput,
  CreateRefundInput,
  CreateTaxRateInput,
  OpenCashDrawerInput,
  ProcessPaymentInput,
  UpdateDiscountInput,
  UpdateTaxRateInput,
} from './types';

function computeCustomerTier(points: number): string {
  if (points >= 1000) return 'PLATINUM';
  if (points >= 500) return 'GOLD';
  if (points >= 200) return 'SILVER';
  return 'BRONZE';
}

export class PaymentsRepository {
  async findDefaultBranchId(): Promise<string | undefined> {
    const branch = await prisma.branch.findFirst({
      where: { deletedAt: null, isActive: true },
      select: { id: true },
    });
    return branch?.id;
  }

  async findPaymentByIdempotencyKey(idempotencyKey: string) {
    return prisma.payment.findUnique({
      where: { idempotencyKey },
      include: {
        order: {
          include: {
            invoice: true,
          },
        },
        refunds: true,
      },
    });
  }

  async findPaymentById(id: string) {
    return prisma.payment.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            invoice: true,
            items: true,
          },
        },
        cashDrawerSession: true,
        refunds: true,
      },
    });
  }

  async findManyPayments(query: {
    page?: number;
    limit?: number;
    branchId?: string;
    orderId?: string;
    method?: PaymentMethod;
    status?: PaymentStatus;
    startDate?: string;
    endDate?: string;
  }) {
    const { skip, take, page, limit } = getPrismaPagination(query);

    const where: Prisma.PaymentWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.method ? { method: query.method } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.startDate || query.endDate
        ? {
            paidAt: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: { paidAt: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              orderType: true,
              status: true,
              totalAmount: true,
              paidAmount: true,
            },
          },
          refunds: true,
        },
      }),
      prisma.payment.count({ where }),
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

  async findOrderForPayment(orderId: string) {
    return prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: {
        payments: {
          include: { refunds: true },
        },
        invoice: true,
        customer: true,
      },
    });
  }

  async executePaymentTransaction(
    input: ProcessPaymentInput & {
      branchId: string;
      changeAmount: number;
      invoiceNumber: string;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: input.orderId },
        include: { invoice: true, customer: true },
      });

      // Find open cash drawer session if CASH and none explicitly provided
      let activeCashDrawerId = input.cashDrawerSessionId;
      if (!activeCashDrawerId && input.method === PaymentMethod.CASH) {
        const openDrawer = await tx.cashDrawerSession.findFirst({
          where: {
            branchId: input.branchId,
            status: CashDrawerStatus.OPEN,
          },
          orderBy: { openedAt: 'desc' },
        });
        activeCashDrawerId = openDrawer?.id;
      }

      const payment = await tx.payment.create({
        data: {
          branchId: input.branchId,
          orderId: input.orderId,
          cashDrawerSessionId: activeCashDrawerId ?? null,
          idempotencyKey: input.idempotencyKey,
          method: input.method,
          status: PaymentStatus.COMPLETED,
          amount: input.amount,
          tipAmount: input.tipAmount ?? 0,
          tenderedAmount: input.tenderedAmount ?? input.amount,
          changeAmount: input.changeAmount,
          transactionRef: input.transactionRef,
          gatewayProvider: input.gatewayProvider,
          gatewayResponse: input.gatewayResponse
            ? (input.gatewayResponse as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          createdBy: input.actorUserId,
          updatedBy: input.actorUserId,
        },
      });

      // Update cash drawer expected balance on CASH payment
      if (activeCashDrawerId && input.method === PaymentMethod.CASH) {
        await tx.cashDrawerSession.update({
          where: { id: activeCashDrawerId },
          data: {
            expectedBalance: { increment: input.amount },
          },
        });
      }

      const newPaidAmount = Number((Number(order.paidAmount) + input.amount).toFixed(2));
      const newTipAmount = Number(
        (Number(order.tipAmount) + (input.tipAmount ?? 0)).toFixed(2)
      );
      const newTotalAmount = Number(
        (Number(order.totalAmount) + (input.tipAmount ?? 0)).toFixed(2)
      );
      const isFullyPaid = newPaidAmount >= Number(order.totalAmount);

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          paidAmount: newPaidAmount,
          tipAmount: newTipAmount,
          totalAmount: newTotalAmount,
          cashierId: input.actorUserId ?? order.cashierId,
          status: isFullyPaid ? OrderStatus.PAID : order.status,
          completedAt: isFullyPaid ? new Date() : order.completedAt,
          updatedBy: input.actorUserId,
        },
      });

      // Release table to CLEANING once order is paid
      if (isFullyPaid && order.tableId) {
        await tx.table.update({
          where: { id: order.tableId },
          data: {
            status: TableStatus.CLEANING,
            updatedBy: input.actorUserId,
          },
        });
      }

      // Generate Invoice record if fully paid and no invoice exists yet
      if (isFullyPaid && !order.invoice) {
        await tx.invoice.create({
          data: {
            orderId: order.id,
            invoiceNumber: input.invoiceNumber,
            pdfUrl: `/api/v1/orders/${order.id}/invoice/pdf`,
          },
        });
      }

      // Award Loyalty Points if order is fully paid and linked to a customer
      if (isFullyPaid && order.customerId && order.customer) {
        const earnedPoints = Math.max(1, Math.floor(Number(updatedOrder.totalAmount)));
        const newPointsBalance = order.customer.loyaltyPoints + earnedPoints;
        const newTier = computeCustomerTier(newPointsBalance);

        await tx.customer.update({
          where: { id: order.customerId },
          data: {
            loyaltyPoints: newPointsBalance,
            tier: newTier,
            totalSpent: { increment: Number(updatedOrder.totalAmount) },
            visitCount: { increment: 1 },
            lastVisitAt: new Date(),
            segment: newPointsBalance >= 500 ? 'VIP' : 'REGULAR',
          },
        });

        await tx.loyaltyTransaction.create({
          data: {
            customerId: order.customerId,
            orderId: order.id,
            type: LoyaltyTxType.EARN,
            points: earnedPoints,
            balanceAfter: newPointsBalance,
            description: `Points earned from order ${order.orderNumber}`,
            createdBy: input.actorUserId,
          },
        });
      }

      return tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
        include: {
          order: {
            include: {
              invoice: true,
              table: true,
              customer: true,
            },
          },
          refunds: true,
        },
      });
    });
  }

  async executeRefundTransaction(
    input: CreateRefundInput & {
      orderId: string;
      newPaymentStatus: PaymentStatus;
      cashDrawerSessionId?: string | null;
      isCashPayment: boolean;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const refund = await tx.refund.create({
        data: {
          paymentId: input.paymentId,
          orderId: input.orderId,
          amount: input.amount,
          reason: input.reason,
          approvedBy: input.approvedBy ?? input.actorUserId,
          createdBy: input.actorUserId,
        },
      });

      const updatedPayment = await tx.payment.update({
        where: { id: input.paymentId },
        data: {
          status: input.newPaymentStatus,
          updatedBy: input.actorUserId,
        },
        include: {
          refunds: true,
        },
      });

      await tx.order.update({
        where: { id: input.orderId },
        data: {
          paidAmount: { decrement: input.amount },
          updatedBy: input.actorUserId,
        },
      });

      if (input.isCashPayment && input.cashDrawerSessionId) {
        const session = await tx.cashDrawerSession.findUnique({
          where: { id: input.cashDrawerSessionId },
        });
        if (session && session.status === CashDrawerStatus.OPEN) {
          await tx.cashDrawerSession.update({
            where: { id: session.id },
            data: {
              expectedBalance: { decrement: input.amount },
            },
          });
        }
      }

      return { refund, payment: updatedPayment };
    });
  }

  async findManyRefunds(branchId?: string, page = 1, limit = 20) {
    const { skip, take } = getPrismaPagination({ page, limit });
    const where: Prisma.RefundWhereInput = branchId
      ? { payment: { branchId } }
      : {};

    const [items, total] = await Promise.all([
      prisma.refund.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          payment: {
            select: {
              id: true,
              method: true,
              amount: true,
              status: true,
              order: {
                select: { id: true, orderNumber: true, totalAmount: true },
              },
            },
          },
        },
      }),
      prisma.refund.count({ where }),
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

  // Cash Drawer Sessions
  async findOpenCashDrawer(branchId: string) {
    return prisma.cashDrawerSession.findFirst({
      where: {
        branchId,
        status: CashDrawerStatus.OPEN,
      },
      include: {
        payments: {
          orderBy: { paidAt: 'desc' },
        },
      },
    });
  }

  async findCashDrawerById(id: string) {
    return prisma.cashDrawerSession.findUnique({
      where: { id },
      include: {
        payments: {
          include: { refunds: true },
          orderBy: { paidAt: 'desc' },
        },
      },
    });
  }

  async findManyCashDrawers(query: {
    branchId?: string;
    status?: CashDrawerStatus;
    page?: number;
    limit?: number;
  }) {
    const { skip, take, page, limit } = getPrismaPagination(query);
    const where: Prisma.CashDrawerSessionWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.cashDrawerSession.findMany({
        where,
        skip,
        take,
        orderBy: { openedAt: 'desc' },
        include: {
          _count: { select: { payments: true } },
        },
      }),
      prisma.cashDrawerSession.count({ where }),
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

  async openCashDrawer(input: OpenCashDrawerInput & { branchId: string }) {
    return prisma.cashDrawerSession.create({
      data: {
        branchId: input.branchId,
        openedByUserId: input.actorUserId,
        openingBalance: input.openingBalance,
        expectedBalance: input.openingBalance,
        status: CashDrawerStatus.OPEN,
        notes: input.notes,
      },
    });
  }

  async closeCashDrawer(
    id: string,
    input: CloseCashDrawerInput & { discrepancy: number }
  ) {
    return prisma.cashDrawerSession.update({
      where: { id },
      data: {
        closedByUserId: input.actorUserId,
        closingBalance: input.closingBalance,
        discrepancy: input.discrepancy,
        status: CashDrawerStatus.CLOSED,
        closedAt: new Date(),
        notes: input.notes,
      },
      include: {
        payments: true,
      },
    });
  }

  // Tax Rates
  async findTaxRates(branchId?: string) {
    return prisma.taxRate.findMany({
      where: {
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findTaxRateById(id: string) {
    return prisma.taxRate.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async createTaxRate(input: CreateTaxRateInput & { branchId: string }) {
    return prisma.taxRate.create({
      data: {
        branchId: input.branchId,
        name: input.name,
        ratePercent: input.ratePercent,
        isInclusive: input.isInclusive ?? false,
        isActive: input.isActive ?? true,
      },
    });
  }

  async updateTaxRate(id: string, input: UpdateTaxRateInput) {
    return prisma.taxRate.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.ratePercent !== undefined ? { ratePercent: input.ratePercent } : {}),
        ...(input.isInclusive !== undefined ? { isInclusive: input.isInclusive } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  }

  async softDeleteTaxRate(id: string) {
    return prisma.taxRate.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // Discounts
  async findDiscounts(branchId?: string) {
    return prisma.discount.findMany({
      where: {
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findDiscountById(id: string) {
    return prisma.discount.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async createDiscount(input: CreateDiscountInput & { branchId: string }) {
    return prisma.discount.create({
      data: {
        branchId: input.branchId,
        name: input.name,
        type: input.type,
        value: input.value,
        minOrderAmount: input.minOrderAmount ?? 0,
        maxDiscount: input.maxDiscount ?? null,
        isActive: input.isActive ?? true,
      },
    });
  }

  async updateDiscount(id: string, input: UpdateDiscountInput) {
    return prisma.discount.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.value !== undefined ? { value: input.value } : {}),
        ...(input.minOrderAmount !== undefined ? { minOrderAmount: input.minOrderAmount } : {}),
        ...(input.maxDiscount !== undefined ? { maxDiscount: input.maxDiscount } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  }

  async softDeleteDiscount(id: string) {
    return prisma.discount.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}

export const paymentsRepository = new PaymentsRepository();

