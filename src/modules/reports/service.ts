import { PaymentMethod } from '@prisma/client';
import { getCurrencyDetails } from '../../constants/currencies';
import { ValidationError } from '../../errors';
import { reportsRepository } from './repository';
import { ReportFilterInput, ReportTableResult } from './types';

function resolvePeriod(startDate?: string, endDate?: string, defaultDays = 30) {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - defaultDays * 24 * 60 * 60 * 1000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new ValidationError('Invalid startDate or endDate');
  }
  return { start, end };
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

export class ReportsService {
  private async resolveContext(filter: ReportFilterInput) {
    const branchId = filter.branchId || (await reportsRepository.findDefaultBranchId());
    if (!branchId) {
      throw new ValidationError('branchId is required when no active branch exists');
    }
    const currencyCode = await reportsRepository.findBranchCurrency(branchId);
    const currencyInfo = getCurrencyDetails(currencyCode);
    const { start, end } = resolvePeriod(filter.startDate, filter.endDate);
    return { branchId, currencyInfo, start, end };
  }

  async getSalesByItem(filter: ReportFilterInput): Promise<ReportTableResult> {
    const { branchId, currencyInfo, start, end } = await this.resolveContext(filter);
    const items = await reportsRepository.findOrderItemsForSalesReport(branchId, start, end);

    const map = new Map<
      string,
      {
        menuItemId: string;
        sku: string;
        itemName: string;
        categoryName: string;
        quantitySold: number;
        grossRevenue: number;
        orderIds: Set<string>;
      }
    >();

    for (const item of items) {
      const key = item.menuItemId;
      const existing = map.get(key) ?? {
        menuItemId: item.menuItemId,
        sku: item.menuItem?.sku ?? '-',
        itemName: item.itemName,
        categoryName: item.menuItem?.category?.name ?? 'Uncategorized',
        quantitySold: 0,
        grossRevenue: 0,
        orderIds: new Set<string>(),
      };

      existing.quantitySold += item.quantity;
      existing.grossRevenue += Number(item.subtotal);
      existing.orderIds.add(item.orderId);
      map.set(key, existing);
    }

    const rows = Array.from(map.values())
      .sort((a, b) => b.grossRevenue - a.grossRevenue)
      .slice(0, filter.limit ?? 100)
      .map((entry) => ({
        menuItemId: entry.menuItemId,
        sku: entry.sku,
        itemName: entry.itemName,
        categoryName: entry.categoryName,
        quantitySold: entry.quantitySold,
        orderCount: entry.orderIds.size,
        grossRevenue: round2(entry.grossRevenue),
      }));

    const totalQuantity = rows.reduce((s, r) => s + r.quantitySold, 0);
    const totalRevenue = round2(rows.reduce((s, r) => s + r.grossRevenue, 0));

    return {
      title: 'Sales by Menu Item',
      filename: 'sales-by-item',
      branchId,
      currency: currencyInfo.code,
      currencySymbol: currencyInfo.symbol,
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      generatedAt: new Date().toISOString(),
      summary: {
        totalItemsSold: totalQuantity,
        uniqueMenuItems: rows.length,
        totalRevenue,
      },
      columns: [
        { key: 'sku', header: 'SKU' },
        { key: 'itemName', header: 'Item Name' },
        { key: 'categoryName', header: 'Category' },
        { key: 'quantitySold', header: 'Qty Sold' },
        { key: 'orderCount', header: 'Orders' },
        { key: 'grossRevenue', header: 'Revenue', isCurrency: true },
      ],
      rows,
    };
  }

  async getSalesByCategory(filter: ReportFilterInput): Promise<ReportTableResult> {
    const { branchId, currencyInfo, start, end } = await this.resolveContext(filter);
    const items = await reportsRepository.findOrderItemsForSalesReport(branchId, start, end);

    const map = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        quantitySold: number;
        grossRevenue: number;
        orderIds: Set<string>;
      }
    >();

    let grandTotal = 0;
    for (const item of items) {
      const catId = item.menuItem?.category?.id ?? 'uncategorized';
      const catName = item.menuItem?.category?.name ?? 'Uncategorized';
      const revenue = Number(item.subtotal);
      grandTotal += revenue;

      const existing = map.get(catId) ?? {
        categoryId: catId,
        categoryName: catName,
        quantitySold: 0,
        grossRevenue: 0,
        orderIds: new Set<string>(),
      };

      existing.quantitySold += item.quantity;
      existing.grossRevenue += revenue;
      existing.orderIds.add(item.orderId);
      map.set(catId, existing);
    }

    const rows = Array.from(map.values())
      .sort((a, b) => b.grossRevenue - a.grossRevenue)
      .map((entry) => ({
        categoryId: entry.categoryId,
        categoryName: entry.categoryName,
        quantitySold: entry.quantitySold,
        orderCount: entry.orderIds.size,
        grossRevenue: round2(entry.grossRevenue),
        revenueSharePercent:
          grandTotal > 0 ? round2((entry.grossRevenue / grandTotal) * 100) : 0,
      }));

    return {
      title: 'Sales by Category',
      filename: 'sales-by-category',
      branchId,
      currency: currencyInfo.code,
      currencySymbol: currencyInfo.symbol,
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      generatedAt: new Date().toISOString(),
      summary: {
        categoryCount: rows.length,
        totalRevenue: round2(grandTotal),
      },
      columns: [
        { key: 'categoryName', header: 'Category' },
        { key: 'quantitySold', header: 'Items Sold' },
        { key: 'orderCount', header: 'Orders' },
        { key: 'grossRevenue', header: 'Revenue', isCurrency: true },
        { key: 'revenueSharePercent', header: 'Share (%)' },
      ],
      rows,
    };
  }

  async getSalesByStaff(filter: ReportFilterInput): Promise<ReportTableResult> {
    const { branchId, currencyInfo, start, end } = await this.resolveContext(filter);
    const orders = await reportsRepository.findOrdersWithStaff(branchId, start, end);

    const map = new Map<
      string,
      {
        staffId: string;
        staffName: string;
        email: string;
        orderCount: number;
        totalSales: number;
        totalTips: number;
      }
    >();

    for (const order of orders) {
      const staff = order.waiter ?? order.cashier;
      const staffId = staff?.id ?? 'unassigned';
      const staffName = staff ? `${staff.firstName} ${staff.lastName}` : 'Unassigned POS';
      const email = staff?.email ?? '-';

      const existing = map.get(staffId) ?? {
        staffId,
        staffName,
        email,
        orderCount: 0,
        totalSales: 0,
        totalTips: 0,
      };

      existing.orderCount += 1;
      existing.totalSales += Number(order.totalAmount);
      existing.totalTips += Number(order.tipAmount);
      map.set(staffId, existing);
    }

    const rows = Array.from(map.values())
      .sort((a, b) => b.totalSales - a.totalSales)
      .map((entry) => ({
        staffId: entry.staffId,
        staffName: entry.staffName,
        email: entry.email,
        orderCount: entry.orderCount,
        totalSales: round2(entry.totalSales),
        totalTips: round2(entry.totalTips),
        averageTicket:
          entry.orderCount > 0 ? round2(entry.totalSales / entry.orderCount) : 0,
      }));

    return {
      title: 'Sales by Staff Member',
      filename: 'sales-by-staff',
      branchId,
      currency: currencyInfo.code,
      currencySymbol: currencyInfo.symbol,
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      generatedAt: new Date().toISOString(),
      summary: {
        staffCount: rows.length,
        totalOrders: orders.length,
        totalSales: round2(rows.reduce((s, r) => s + r.totalSales, 0)),
        totalTips: round2(rows.reduce((s, r) => s + r.totalTips, 0)),
      },
      columns: [
        { key: 'staffName', header: 'Staff Name' },
        { key: 'email', header: 'Email' },
        { key: 'orderCount', header: 'Orders' },
        { key: 'totalSales', header: 'Total Sales', isCurrency: true },
        { key: 'totalTips', header: 'Tips', isCurrency: true },
        { key: 'averageTicket', header: 'Avg Ticket', isCurrency: true },
      ],
      rows,
    };
  }

  async getSalesByPayment(filter: ReportFilterInput): Promise<ReportTableResult> {
    const { branchId, currencyInfo, start, end } = await this.resolveContext(filter);
    const payments = await reportsRepository.findCompletedPayments(branchId, start, end);

    const map = new Map<
      PaymentMethod,
      { method: PaymentMethod; transactionCount: number; amount: number; tips: number }
    >();

    let grandTotal = 0;
    for (const p of payments) {
      const amt = Number(p.amount);
      grandTotal += amt;
      const existing = map.get(p.method) ?? {
        method: p.method,
        transactionCount: 0,
        amount: 0,
        tips: 0,
      };
      existing.transactionCount += 1;
      existing.amount += amt;
      existing.tips += Number(p.tipAmount);
      map.set(p.method, existing);
    }

    const rows = Array.from(map.values())
      .sort((a, b) => b.amount - a.amount)
      .map((entry) => ({
        method: entry.method,
        transactionCount: entry.transactionCount,
        totalAmount: round2(entry.amount),
        totalTips: round2(entry.tips),
        sharePercent: grandTotal > 0 ? round2((entry.amount / grandTotal) * 100) : 0,
      }));

    return {
      title: 'Sales by Payment Method',
      filename: 'sales-by-payment',
      branchId,
      currency: currencyInfo.code,
      currencySymbol: currencyInfo.symbol,
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      generatedAt: new Date().toISOString(),
      summary: {
        totalTransactions: payments.length,
        totalCollected: round2(grandTotal),
        totalTips: round2(rows.reduce((s, r) => s + r.totalTips, 0)),
      },
      columns: [
        { key: 'method', header: 'Payment Method' },
        { key: 'transactionCount', header: 'Transactions' },
        { key: 'totalAmount', header: 'Amount', isCurrency: true },
        { key: 'totalTips', header: 'Tips', isCurrency: true },
        { key: 'sharePercent', header: 'Share (%)' },
      ],
      rows,
    };
  }

  async getSalesByTime(filter: ReportFilterInput): Promise<ReportTableResult> {
    const { branchId, currencyInfo, start, end } = await this.resolveContext(filter);
    const orders = await reportsRepository.findOrdersWithStaff(branchId, start, end);

    const dailyMap = new Map<
      string,
      { date: string; orderCount: number; revenue: number; tax: number; discount: number }
    >();
    const hourlyMap = new Map<
      number,
      { hour: number; label: string; orderCount: number; revenue: number }
    >();

    for (let h = 0; h < 24; h++) {
      hourlyMap.set(h, {
        hour: h,
        label: `${String(h).padStart(2, '0')}:00`,
        orderCount: 0,
        revenue: 0,
      });
    }

    for (const order of orders) {
      const dt = new Date(order.createdAt);
      const dayKey = dt.toISOString().slice(0, 10);
      const hourKey = dt.getUTCHours();

      const total = Number(order.totalAmount);
      const dayEntry = dailyMap.get(dayKey) ?? {
        date: dayKey,
        orderCount: 0,
        revenue: 0,
        tax: 0,
        discount: 0,
      };
      dayEntry.orderCount += 1;
      dayEntry.revenue += total;
      dayEntry.tax += Number(order.taxAmount);
      dayEntry.discount += Number(order.discountAmount);
      dailyMap.set(dayKey, dayEntry);

      const hourEntry = hourlyMap.get(hourKey);
      if (hourEntry) {
        hourEntry.orderCount += 1;
        hourEntry.revenue += total;
      }
    }

    const dailyRows = Array.from(dailyMap.values()).map((d) => ({
      date: d.date,
      orderCount: d.orderCount,
      revenue: round2(d.revenue),
      taxCollected: round2(d.tax),
      discountGiven: round2(d.discount),
      averageOrderValue: d.orderCount > 0 ? round2(d.revenue / d.orderCount) : 0,
    }));

    const peakHours = Array.from(hourlyMap.values())
      .map((h) => ({ ...h, revenue: round2(h.revenue) }))
      .sort((a, b) => b.revenue - a.revenue);

    const totalRevenue = round2(dailyRows.reduce((s, r) => s + r.revenue, 0));

    return {
      title: 'Sales by Time & Peak Hours',
      filename: 'sales-by-time',
      branchId,
      currency: currencyInfo.code,
      currencySymbol: currencyInfo.symbol,
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      generatedAt: new Date().toISOString(),
      summary: {
        totalDaysWithSales: dailyRows.length,
        totalOrders: orders.length,
        totalRevenue,
        peakHour: peakHours[0]?.label ?? 'N/A',
      },
      columns: [
        { key: 'date', header: 'Date' },
        { key: 'orderCount', header: 'Orders' },
        { key: 'revenue', header: 'Revenue', isCurrency: true },
        { key: 'taxCollected', header: 'Tax', isCurrency: true },
        { key: 'discountGiven', header: 'Discounts', isCurrency: true },
        { key: 'averageOrderValue', header: 'AOV', isCurrency: true },
      ],
      rows: dailyRows,
      extra: {
        hourlyBreakdown: Array.from(hourlyMap.values()).map((h) => ({
          ...h,
          revenue: round2(h.revenue),
        })),
      },
    };
  }

  async getInventoryValuation(filter: ReportFilterInput): Promise<ReportTableResult> {
    const { branchId, currencyInfo, start, end } = await this.resolveContext(filter);
    const ingredients = await reportsRepository.findActiveIngredients(branchId);

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    let totalStockValue = 0;
    let lowStockCount = 0;
    let expiringSoonCount = 0;

    const rows = ingredients.map((ing) => {
      const qty = Number(ing.currentStock);
      const reorder = Number(ing.reorderLevel);
      const unitCost = Number(ing.costPerUnit);
      const stockValue = round2(qty * unitCost);
      totalStockValue += stockValue;

      const isLowStock = qty <= reorder;
      if (isLowStock) lowStockCount += 1;

      const isExpiringSoon = Boolean(
        ing.expiryDate && ing.expiryDate.getTime() - now <= sevenDaysMs
      );
      if (isExpiringSoon) expiringSoonCount += 1;

      return {
        ingredientId: ing.id,
        sku: ing.sku,
        name: ing.name,
        unit: ing.unit,
        currentStock: qty,
        reorderLevel: reorder,
        costPerUnit: unitCost,
        stockValue,
        status: isLowStock ? 'LOW_STOCK' : 'HEALTHY',
        expiryDate: ing.expiryDate ? ing.expiryDate.toISOString().slice(0, 10) : '-',
      };
    });

    return {
      title: 'Inventory Stock Valuation',
      filename: 'inventory-valuation',
      branchId,
      currency: currencyInfo.code,
      currencySymbol: currencyInfo.symbol,
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      generatedAt: new Date().toISOString(),
      summary: {
        totalIngredients: rows.length,
        lowStockCount,
        expiringSoonCount,
        totalValuation: round2(totalStockValue),
      },
      columns: [
        { key: 'sku', header: 'SKU' },
        { key: 'name', header: 'Ingredient' },
        { key: 'currentStock', header: 'Stock' },
        { key: 'unit', header: 'Unit' },
        { key: 'costPerUnit', header: 'Unit Cost', isCurrency: true },
        { key: 'stockValue', header: 'Valuation', isCurrency: true },
        { key: 'status', header: 'Status' },
      ],
      rows,
    };
  }

  async getWastageReport(filter: ReportFilterInput): Promise<ReportTableResult> {
    const { branchId, currencyInfo, start, end } = await this.resolveContext(filter);
    const logs = await reportsRepository.findWastageLogs(branchId, start, end);

    let totalLoss = 0;
    const reasonMap = new Map<string, { count: number; loss: number }>();

    const rows = logs.map((log) => {
      const loss = Number(log.costLoss);
      totalLoss += loss;
      const reasonStats = reasonMap.get(log.reason) ?? { count: 0, loss: 0 };
      reasonStats.count += 1;
      reasonStats.loss += loss;
      reasonMap.set(log.reason, reasonStats);

      return {
        id: log.id,
        date: log.createdAt.toISOString().slice(0, 10),
        sku: log.ingredient.sku,
        ingredientName: log.ingredient.name,
        quantity: Number(log.quantity),
        unit: log.ingredient.unit,
        costLoss: round2(loss),
        reason: log.reason,
      };
    });

    return {
      title: 'Inventory Wastage & Spoilage Report',
      filename: 'wastage-report',
      branchId,
      currency: currencyInfo.code,
      currencySymbol: currencyInfo.symbol,
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      generatedAt: new Date().toISOString(),
      summary: {
        totalIncidents: rows.length,
        totalCostLoss: round2(totalLoss),
        byReason: Array.from(reasonMap.entries()).map(([reason, stats]) => ({
          reason,
          incidents: stats.count,
          costLoss: round2(stats.loss),
        })),
      },
      columns: [
        { key: 'date', header: 'Date' },
        { key: 'sku', header: 'SKU' },
        { key: 'ingredientName', header: 'Ingredient' },
        { key: 'quantity', header: 'Qty' },
        { key: 'unit', header: 'Unit' },
        { key: 'costLoss', header: 'Cost Loss', isCurrency: true },
        { key: 'reason', header: 'Reason' },
      ],
      rows,
    };
  }

  async getCustomerRetentionReport(filter: ReportFilterInput): Promise<ReportTableResult> {
    const { branchId, currencyInfo, start, end } = await this.resolveContext(filter);
    const customers = await reportsRepository.findCustomersForRetention(branchId);

    const segmentCounts: Record<string, number> = {
      NEW: 0,
      REGULAR: 0,
      VIP: 0,
      AT_RISK: 0,
    };

    let repeatCustomers = 0;
    let totalSpentAll = 0;
    let totalLoyaltyPoints = 0;

    const rows = customers.map((c) => {
      const spent = Number(c.totalSpent);
      totalSpentAll += spent;
      totalLoyaltyPoints += c.loyaltyPoints;
      if (c.visitCount > 1) repeatCustomers += 1;
      segmentCounts[c.segment] = (segmentCounts[c.segment] ?? 0) + 1;

      return {
        customerId: c.id,
        name: `${c.firstName} ${c.lastName}`,
        phone: c.phone,
        tier: c.tier,
        segment: c.segment,
        visitCount: c.visitCount,
        loyaltyPoints: c.loyaltyPoints,
        totalSpent: round2(spent),
        lastVisitAt: c.lastVisitAt ? c.lastVisitAt.toISOString().slice(0, 10) : '-',
      };
    });

    const totalCustomers = customers.length;
    const repeatRatePercent =
      totalCustomers > 0 ? round2((repeatCustomers / totalCustomers) * 100) : 0;
    const averageLtv = totalCustomers > 0 ? round2(totalSpentAll / totalCustomers) : 0;

    return {
      title: 'Customer Retention & Loyalty Report',
      filename: 'customer-retention',
      branchId,
      currency: currencyInfo.code,
      currencySymbol: currencyInfo.symbol,
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      generatedAt: new Date().toISOString(),
      summary: {
        totalCustomers,
        repeatCustomers,
        repeatRatePercent,
        averageLifetimeValue: averageLtv,
        totalLoyaltyPointsInCirculation: totalLoyaltyPoints,
        segmentCounts,
      },
      columns: [
        { key: 'name', header: 'Customer' },
        { key: 'phone', header: 'Phone' },
        { key: 'tier', header: 'Tier' },
        { key: 'segment', header: 'Segment' },
        { key: 'visitCount', header: 'Visits' },
        { key: 'loyaltyPoints', header: 'Points' },
        { key: 'totalSpent', header: 'Total Spent', isCurrency: true },
      ],
      rows: rows.slice(0, filter.limit ?? 100),
    };
  }

  async getDiscountUsageReport(filter: ReportFilterInput): Promise<ReportTableResult> {
    const { branchId, currencyInfo, start, end } = await this.resolveContext(filter);
    const [orders, coupons] = await Promise.all([
      reportsRepository.findOrdersWithStaff(branchId, start, end),
      reportsRepository.findCoupons(branchId),
    ]);

    const discountedOrders = orders.filter(
      (o) => Number(o.discountAmount) > 0 || Boolean(o.couponCode)
    );

    const promoMap = new Map<
      string,
      { codeOrRule: string; usageCount: number; totalDiscountGiven: number }
    >();

    let totalDiscountGiven = 0;
    for (const order of discountedOrders) {
      const discount = Number(order.discountAmount);
      totalDiscountGiven += discount;
      const key = order.couponCode || order.discount?.name || 'MANUAL_DISCOUNT';
      const existing = promoMap.get(key) ?? {
        codeOrRule: key,
        usageCount: 0,
        totalDiscountGiven: 0,
      };
      existing.usageCount += 1;
      existing.totalDiscountGiven += discount;
      promoMap.set(key, existing);
    }

    const rows = Array.from(promoMap.values())
      .sort((a, b) => b.totalDiscountGiven - a.totalDiscountGiven)
      .map((entry) => ({
        codeOrRule: entry.codeOrRule,
        usageCount: entry.usageCount,
        totalDiscountGiven: round2(entry.totalDiscountGiven),
      }));

    return {
      title: 'Promotions, Coupons & Discount Usage Report',
      filename: 'discount-usage',
      branchId,
      currency: currencyInfo.code,
      currencySymbol: currencyInfo.symbol,
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      generatedAt: new Date().toISOString(),
      summary: {
        discountedOrdersCount: discountedOrders.length,
        totalDiscountGiven: round2(totalDiscountGiven),
        configuredCoupons: coupons.map((c) => ({
          code: c.code,
          type: c.type,
          value: Number(c.value),
          usedCount: c.usedCount,
          usageLimit: c.usageLimit,
          isActive: c.isActive,
        })),
      },
      columns: [
        { key: 'codeOrRule', header: 'Coupon / Discount Rule' },
        { key: 'usageCount', header: 'Times Used' },
        { key: 'totalDiscountGiven', header: 'Total Discount', isCurrency: true },
      ],
      rows,
    };
  }
}

export const reportsService = new ReportsService();

