import { OrderStatus, PaymentMethod } from '@prisma/client';
import { getCurrencyDetails } from '../../constants/currencies';
import { NotFoundError, ValidationError } from '../../errors';
import { auditService } from '../audit/service';
import { expensesRepository } from './repository';
import {
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  DateRangeInput,
  UpdateExpenseCategoryInput,
  UpdateExpenseInput,
} from './types';

function resolvePeriod(startDate?: string, endDate?: string, defaultDays = 30) {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - defaultDays * 24 * 60 * 60 * 1000);
  return { start, end };
}

export class ExpensesService {
  private async ensureBranchId(branchId?: string): Promise<string> {
    if (branchId) return branchId;
    const defaultBranchId = await expensesRepository.findDefaultBranchId();
    if (!defaultBranchId) {
      throw new ValidationError('branchId is required when no active branch exists');
    }
    return defaultBranchId;
  }

  // Categories
  async listCategories(branchId?: string) {
    return expensesRepository.findCategories(branchId);
  }

  async createCategory(input: CreateExpenseCategoryInput) {
    const branchId = await this.ensureBranchId(input.branchId);
    return expensesRepository.createCategory({ ...input, branchId });
  }

  async updateCategory(id: string, input: UpdateExpenseCategoryInput) {
    const existing = await expensesRepository.findCategoryById(id);
    if (!existing) throw new NotFoundError('Expense category');
    return expensesRepository.updateCategory(id, input);
  }

  async deleteCategory(id: string) {
    const existing = await expensesRepository.findCategoryById(id);
    if (!existing) throw new NotFoundError('Expense category');
    await expensesRepository.softDeleteCategory(id);
  }

  // Expenses CRUD
  async listExpenses(query: any) {
    return expensesRepository.findManyExpenses(query);
  }

  async getExpenseById(id: string) {
    const expense = await expensesRepository.findExpenseById(id);
    if (!expense) throw new NotFoundError('Expense');
    return expense;
  }

  async createExpense(input: CreateExpenseInput) {
    const category = await expensesRepository.findCategoryById(input.categoryId);
    if (!category) throw new NotFoundError('Expense category');

    const branchId = input.branchId || category.branchId;
    const created = await expensesRepository.createExpense({
      ...input,
      branchId,
    });

    await auditService.log({
      branchId,
      userId: input.actorUserId,
      action: 'EXPENSE_CREATED',
      entity: 'Expense',
      entityId: created.id,
      newValues: {
        title: created.title,
        amount: Number(created.amount),
        method: created.method,
        categoryId: created.categoryId,
      },
    });

    return created;
  }

  async updateExpense(id: string, input: UpdateExpenseInput) {
    const existing = await this.getExpenseById(id);
    const updated = await expensesRepository.updateExpense(id, input);

    await auditService.log({
      branchId: existing.branchId,
      userId: input.actorUserId,
      action: 'EXPENSE_UPDATED',
      entity: 'Expense',
      entityId: id,
      oldValues: { title: existing.title, amount: Number(existing.amount) },
      newValues: input as Record<string, any>,
    });

    return updated;
  }

  async deleteExpense(id: string, actorUserId?: string) {
    const existing = await this.getExpenseById(id);
    await expensesRepository.softDeleteExpense(id, actorUserId);

    await auditService.log({
      branchId: existing.branchId,
      userId: actorUserId,
      action: 'EXPENSE_DELETED',
      entity: 'Expense',
      entityId: id,
    });
  }

  // Accounting Reports
  async getPnLReport(params: DateRangeInput) {
    const branchId = await this.ensureBranchId(params.branchId);
    const { start, end } = resolvePeriod(params.startDate, params.endDate, 30);
    const [currencyCode, data] = await Promise.all([
      expensesRepository.findBranchCurrency(branchId),
      expensesRepository.getPnLData(branchId, start, end),
    ]);

    const currency = getCurrencyDetails(currencyCode);
    const grossSales = Number(data.ordersAgg._sum.subtotal ?? 0);
    const totalDiscounts = Number(data.ordersAgg._sum.discountAmount ?? 0);
    const serviceCharges = Number(data.ordersAgg._sum.serviceCharge ?? 0);
    const deliveryFees = Number(data.ordersAgg._sum.deliveryFee ?? 0);
    const netSales = Number(
      (grossSales - totalDiscounts + serviceCharges + deliveryFees).toFixed(2)
    );

    const estimatedRecipeCogs = Number(
      data.orderItems
        .reduce(
          (sum, item) => sum + item.quantity * Number(item.menuItem.costPrice ?? 0),
          0
        )
        .toFixed(2)
    );
    const totalCogs = Number((estimatedRecipeCogs + data.wastageLoss).toFixed(2));
    const grossProfit = Number((netSales - totalCogs).toFixed(2));

    const expensesByCategoryMap = new Map<string, number>();
    let recordedExpenses = 0;
    for (const exp of data.expenses) {
      const amt = Number(exp.amount);
      recordedExpenses += amt;
      const catName = exp.category?.name ?? 'Uncategorized';
      expensesByCategoryMap.set(
        catName,
        Number(((expensesByCategoryMap.get(catName) ?? 0) + amt).toFixed(2))
      );
    }

    const totalOperatingExpenses = Number(
      (recordedExpenses + data.payrollTotal).toFixed(2)
    );
    const netProfit = Number((grossProfit - totalOperatingExpenses).toFixed(2));
    const netProfitMarginPercent =
      netSales > 0 ? Number(((netProfit / netSales) * 100).toFixed(2)) : 0;

    return {
      currency,
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      orderCount: data.ordersAgg._count.id,
      revenue: {
        grossSales,
        discounts: totalDiscounts,
        serviceCharges,
        deliveryFees,
        netSales,
        taxCollected: Number(data.ordersAgg._sum.taxAmount ?? 0),
        tipsCollected: Number(data.ordersAgg._sum.tipAmount ?? 0),
      },
      costOfGoodsSold: {
        itemCogs: estimatedRecipeCogs,
        wastageLoss: data.wastageLoss,
        totalCogs,
      },
      grossProfit,
      operatingExpenses: {
        recordedExpenses: Number(recordedExpenses.toFixed(2)),
        payrollTotal: data.payrollTotal,
        totalOperatingExpenses,
        byCategory: Array.from(expensesByCategoryMap.entries()).map(
          ([category, amount]) => ({ category, amount })
        ),
      },
      netProfit,
      netProfitMarginPercent,
    };
  }

  async getDailyClosingReport(params: { branchId?: string; date?: string }) {
    const branchId = await this.ensureBranchId(params.branchId);
    const baseDate = params.date ? new Date(params.date) : new Date();
    const dayStart = new Date(
      Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 0, 0, 0, 0)
    );
    const dayEnd = new Date(
      Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 23, 59, 59, 999)
    );

    const [currencyCode, data] = await Promise.all([
      expensesRepository.findBranchCurrency(branchId),
      expensesRepository.getDailyClosingData(branchId, dayStart, dayEnd),
    ]);

    const currency = getCurrencyDetails(currencyCode);
    const activeOrders = data.orders.filter((o) => o.status !== OrderStatus.CANCELLED);
    const cancelledOrders = data.orders.filter(
      (o) => o.status === OrderStatus.CANCELLED
    );

    const paymentsByMethod: Record<string, number> = {};
    let totalCollected = 0;
    let totalTips = 0;
    for (const p of data.payments) {
      const amt = Number(p.amount);
      totalCollected += amt;
      totalTips += Number(p.tipAmount);
      paymentsByMethod[p.method] = Number(
        ((paymentsByMethod[p.method] ?? 0) + amt).toFixed(2)
      );
    }

    const totalCashExpenses = data.expenses
      .filter((e) => e.method === PaymentMethod.CASH)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const totalAllExpenses = data.expenses.reduce(
      (sum, e) => sum + Number(e.amount),
      0
    );
    const totalRefunds = Number(data.refunds._sum.amount ?? 0);

    return {
      currency,
      date: dayStart.toISOString().slice(0, 10),
      orders: {
        totalOrders: data.orders.length,
        activeOrdersCount: activeOrders.length,
        cancelledOrdersCount: cancelledOrders.length,
        grossRevenue: Number(
          activeOrders.reduce((s, o) => s + Number(o.totalAmount), 0).toFixed(2)
        ),
        totalDiscounts: Number(
          activeOrders.reduce((s, o) => s + Number(o.discountAmount), 0).toFixed(2)
        ),
        totalTax: Number(
          activeOrders.reduce((s, o) => s + Number(o.taxAmount), 0).toFixed(2)
        ),
      },
      payments: {
        totalCollected: Number(totalCollected.toFixed(2)),
        totalTips: Number(totalTips.toFixed(2)),
        byMethod: paymentsByMethod,
        refundsCount: data.refunds._count.id,
        totalRefunds,
      },
      expenses: {
        count: data.expenses.length,
        totalExpenses: Number(totalAllExpenses.toFixed(2)),
        cashExpenses: Number(totalCashExpenses.toFixed(2)),
      },
      cashDrawers: data.cashDrawers,
      netCashFlowForDay: Number(
        ((paymentsByMethod[PaymentMethod.CASH] ?? 0) - totalCashExpenses - totalRefunds).toFixed(2)
      ),
    };
  }

  async getCashFlowReport(params: DateRangeInput) {
    const branchId = await this.ensureBranchId(params.branchId);
    const { start, end } = resolvePeriod(params.startDate, params.endDate, 30);
    const [currencyCode, data] = await Promise.all([
      expensesRepository.findBranchCurrency(branchId),
      expensesRepository.getCashFlowData(branchId, start, end),
    ]);

    const currency = getCurrencyDetails(currencyCode);
    const inflowsByMethod = data.paymentsAgg.map((row) => ({
      method: row.method,
      amount: Number(row._sum.amount ?? 0),
      tips: Number(row._sum.tipAmount ?? 0),
    }));

    const totalInflows = Number(
      inflowsByMethod.reduce((sum, r) => sum + r.amount + r.tips, 0).toFixed(2)
    );
    const totalOutflows = Number(
      (data.totalRefunds + data.totalExpenses + data.totalSupplierPayments).toFixed(2)
    );
    const netCashFlow = Number((totalInflows - totalOutflows).toFixed(2));

    return {
      currency,
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      inflows: {
        totalInflows,
        byMethod: inflowsByMethod,
      },
      outflows: {
        refunds: data.totalRefunds,
        operatingExpenses: data.totalExpenses,
        supplierPayments: data.totalSupplierPayments,
        totalOutflows,
      },
      netCashFlow,
    };
  }

  async getTaxReport(params: DateRangeInput) {
    const branchId = await this.ensureBranchId(params.branchId);
    const { start, end } = resolvePeriod(params.startDate, params.endDate, 30);
    const data = await expensesRepository.getTaxReportData(branchId, start, end);

    const currency = getCurrencyDetails(data.branch?.currency ?? 'PKR');
    const taxableSales = Number(
      Math.max(
        0,
        Number(data.ordersAgg._sum.subtotal ?? 0) -
          Number(data.ordersAgg._sum.discountAmount ?? 0)
      ).toFixed(2)
    );
    const totalTaxCollected = Number(data.ordersAgg._sum.taxAmount ?? 0);

    return {
      currency,
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      branchDefaultTaxRatePercent: Number(data.branch?.taxRatePercent ?? 0),
      orderCount: data.ordersAgg._count.id,
      taxableSales,
      totalTaxCollected,
      configuredTaxRates: data.taxRates,
    };
  }
}

export const expensesService = new ExpensesService();

