import { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { getPrismaPagination } from '../../utils/pagination';
import {
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  UpdateExpenseCategoryInput,
  UpdateExpenseInput,
} from './types';

export class ExpensesRepository {
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

  // Expense Categories
  async findCategories(branchId?: string) {
    return prisma.expenseCategory.findMany({
      where: {
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { expenses: true } },
      },
    });
  }

  async findCategoryById(id: string) {
    return prisma.expenseCategory.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async createCategory(input: CreateExpenseCategoryInput & { branchId: string }) {
    return prisma.expenseCategory.create({
      data: {
        branchId: input.branchId,
        name: input.name,
        description: input.description,
        isActive: input.isActive ?? true,
      },
    });
  }

  async updateCategory(id: string, input: UpdateExpenseCategoryInput) {
    return prisma.expenseCategory.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  }

  async softDeleteCategory(id: string) {
    return prisma.expenseCategory.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // Expenses CRUD
  async findManyExpenses(query: {
    page?: number;
    limit?: number;
    branchId?: string;
    categoryId?: string;
    method?: PaymentMethod;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) {
    const { skip, take, page, limit } = getPrismaPagination(query);

    const where: Prisma.ExpenseWhereInput = {
      deletedAt: null,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.method ? { method: query.method } : {}),
      ...(query.startDate || query.endDate
        ? {
            incurredAt: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { notes: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip,
        take,
        orderBy: { incurredAt: 'desc' },
        include: {
          category: { select: { id: true, name: true } },
        },
      }),
      prisma.expense.count({ where }),
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

  async findExpenseById(id: string) {
    return prisma.expense.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
      },
    });
  }

  async createExpense(input: CreateExpenseInput & { branchId: string }) {
    return prisma.expense.create({
      data: {
        branchId: input.branchId,
        categoryId: input.categoryId,
        title: input.title,
        amount: input.amount,
        method: input.method ?? PaymentMethod.CASH,
        receiptUrl: input.receiptUrl,
        incurredAt: input.incurredAt ? new Date(input.incurredAt) : new Date(),
        notes: input.notes,
        createdBy: input.actorUserId,
        updatedBy: input.actorUserId,
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });
  }

  async updateExpense(id: string, input: UpdateExpenseInput) {
    return prisma.expense.update({
      where: { id },
      data: {
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.method !== undefined ? { method: input.method } : {}),
        ...(input.receiptUrl !== undefined ? { receiptUrl: input.receiptUrl } : {}),
        ...(input.incurredAt !== undefined
          ? { incurredAt: new Date(input.incurredAt) }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        updatedBy: input.actorUserId,
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });
  }

  async softDeleteExpense(id: string, actorUserId?: string) {
    return prisma.expense.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedBy: actorUserId,
      },
    });
  }

  // Accounting Queries (Live Supabase Aggregation)
  async getPnLData(branchId: string, start: Date, end: Date) {
    const [ordersAgg, orderItems, expenses, wastageAgg, payrollAgg] = await Promise.all([
      prisma.order.aggregate({
        where: {
          branchId,
          deletedAt: null,
          status: { not: OrderStatus.CANCELLED },
          createdAt: { gte: start, lte: end },
        },
        _sum: {
          subtotal: true,
          discountAmount: true,
          taxAmount: true,
          serviceCharge: true,
          deliveryFee: true,
          tipAmount: true,
          totalAmount: true,
        },
        _count: { id: true },
      }),
      prisma.orderItem.findMany({
        where: {
          order: {
            branchId,
            deletedAt: null,
            status: { not: OrderStatus.CANCELLED },
            createdAt: { gte: start, lte: end },
          },
        },
        select: {
          quantity: true,
          menuItem: { select: { costPrice: true } },
        },
      }),
      prisma.expense.findMany({
        where: {
          branchId,
          deletedAt: null,
          incurredAt: { gte: start, lte: end },
        },
        include: {
          category: { select: { name: true } },
        },
      }),
      prisma.wastageLog.aggregate({
        where: {
          branchId,
          createdAt: { gte: start, lte: end },
        },
        _sum: { costLoss: true },
      }),
      prisma.payroll.aggregate({
        where: {
          branchId,
          createdAt: { gte: start, lte: end },
        },
        _sum: { netPay: true },
      }),
    ]);

    return {
      ordersAgg,
      orderItems,
      expenses,
      wastageLoss: Number(wastageAgg._sum.costLoss ?? 0),
      payrollTotal: Number(payrollAgg._sum.netPay ?? 0),
    };
  }

  async getDailyClosingData(branchId: string, dayStart: Date, dayEnd: Date) {
    const [orders, payments, refunds, expenses, cashDrawers] = await Promise.all([
      prisma.order.findMany({
        where: {
          branchId,
          deletedAt: null,
          createdAt: { gte: dayStart, lte: dayEnd },
        },
        select: {
          id: true,
          orderType: true,
          status: true,
          totalAmount: true,
          taxAmount: true,
          discountAmount: true,
        },
      }),
      prisma.payment.findMany({
        where: {
          branchId,
          paidAt: { gte: dayStart, lte: dayEnd },
          status: {
            in: [
              PaymentStatus.COMPLETED,
              PaymentStatus.PARTIALLY_REFUNDED,
              PaymentStatus.REFUNDED,
            ],
          },
        },
        select: {
          method: true,
          amount: true,
          tipAmount: true,
        },
      }),
      prisma.refund.aggregate({
        where: {
          payment: { branchId },
          createdAt: { gte: dayStart, lte: dayEnd },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.expense.findMany({
        where: {
          branchId,
          deletedAt: null,
          incurredAt: { gte: dayStart, lte: dayEnd },
        },
        select: { amount: true, method: true, title: true },
      }),
      prisma.cashDrawerSession.findMany({
        where: {
          branchId,
          openedAt: { gte: dayStart, lte: dayEnd },
        },
        orderBy: { openedAt: 'asc' },
      }),
    ]);

    return { orders, payments, refunds, expenses, cashDrawers };
  }

  async getCashFlowData(branchId: string, start: Date, end: Date) {
    const [paymentsAgg, refundsAgg, expensesAgg, supplierPaymentsAgg] =
      await Promise.all([
        prisma.payment.groupBy({
          by: ['method'],
          where: {
            branchId,
            paidAt: { gte: start, lte: end },
            status: {
              in: [PaymentStatus.COMPLETED, PaymentStatus.PARTIALLY_REFUNDED],
            },
          },
          _sum: { amount: true, tipAmount: true },
        }),
        prisma.refund.aggregate({
          where: {
            payment: { branchId },
            createdAt: { gte: start, lte: end },
          },
          _sum: { amount: true },
        }),
        prisma.expense.aggregate({
          where: {
            branchId,
            deletedAt: null,
            incurredAt: { gte: start, lte: end },
          },
          _sum: { amount: true },
        }),
        prisma.supplierPayment.aggregate({
          where: {
            branchId,
            paidAt: { gte: start, lte: end },
          },
          _sum: { amount: true },
        }),
      ]);

    return {
      paymentsAgg,
      totalRefunds: Number(refundsAgg._sum.amount ?? 0),
      totalExpenses: Number(expensesAgg._sum.amount ?? 0),
      totalSupplierPayments: Number(supplierPaymentsAgg._sum.amount ?? 0),
    };
  }

  async getTaxReportData(branchId: string, start: Date, end: Date) {
    const [taxRates, ordersAgg, branch] = await Promise.all([
      prisma.taxRate.findMany({
        where: { branchId, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
      prisma.order.aggregate({
        where: {
          branchId,
          deletedAt: null,
          status: { not: OrderStatus.CANCELLED },
          createdAt: { gte: start, lte: end },
        },
        _sum: {
          subtotal: true,
          discountAmount: true,
          taxAmount: true,
          totalAmount: true,
        },
        _count: { id: true },
      }),
      prisma.branch.findUnique({
        where: { id: branchId },
        select: { taxRatePercent: true, currency: true },
      }),
    ]);

    return { taxRates, ordersAgg, branch };
  }
}

export const expensesRepository = new ExpensesRepository();

