import { OrderStatus, TableStatus } from '@prisma/client';
import { cache } from '../../config/redis';
import { formatCurrencyAmount } from '../../constants/currencies';
import { ValidationError } from '../../errors';
import { branchesService } from '../branches/service';
import { dashboardRepository } from './repository';

const DASHBOARD_CACHE_TTL_SECONDS = 30;

function round2(n: number): number {
  return Number(n.toFixed(2));
}

export class DashboardService {
  async getKpis(params: {
    branchId?: string;
    days?: number;
    lang?: string;
    refresh?: boolean;
  }) {
    const branchId =
      params.branchId || (await dashboardRepository.findDefaultBranchId());
    if (!branchId) {
      throw new ValidationError('branchId is required when no active branch exists');
    }

    const days = params.days ?? 7;
    const cacheKey = `dashboard:kpis:${branchId}:${days}:${params.lang || 'default'}`;

    if (!params.refresh) {
      const cached = await cache.get<Record<string, unknown>>(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }
    }

    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const periodStart = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    periodStart.setUTCHours(0, 0, 0, 0);

    const [
      currencyConfig,
      languageConfig,
      orders,
      tableGroups,
      activeKitchenTickets,
      activeDeliveries,
      ingredients,
      orderItems,
      recentOrders,
    ] = await Promise.all([
      branchesService.getCurrenciesConfig(branchId),
      branchesService.getLanguagesConfig(branchId, params.lang),
      dashboardRepository.findOrdersSince(branchId, periodStart),
      dashboardRepository.findTablesBreakdown(branchId),
      dashboardRepository.countActiveKitchenTickets(branchId),
      dashboardRepository.countActiveDeliveries(branchId),
      dashboardRepository.findActiveIngredients(branchId),
      dashboardRepository.findOrderItemsSince(branchId, periodStart),
      dashboardRepository.findRecentOrders(branchId, 10),
    ]);

    const currencyCode = currencyConfig.activeCurrency.code;

    // Daily & Hourly Aggregations
    const dailyMap = new Map<string, { date: string; ordersCount: number; revenue: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(periodStart.getTime() + i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, { date: key, ordersCount: 0, revenue: 0 });
    }

    const hourlyToday = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      ordersCount: 0,
      revenue: 0,
    }));

    let todayRevenue = 0;
    let todayOrders = 0;
    let todayCancelled = 0;
    let periodRevenue = 0;
    let periodOrders = 0;

    for (const order of orders) {
      const orderDay = order.createdAt.toISOString().slice(0, 10);
      const amount = Number(order.totalAmount);

      if (order.status === OrderStatus.CANCELLED) {
        if (orderDay === todayKey) todayCancelled += 1;
        continue;
      }

      periodRevenue += amount;
      periodOrders += 1;

      const dayBucket = dailyMap.get(orderDay);
      if (dayBucket) {
        dayBucket.ordersCount += 1;
        dayBucket.revenue += amount;
      }

      if (orderDay === todayKey) {
        todayRevenue += amount;
        todayOrders += 1;
        const hr = order.createdAt.getUTCHours();
        hourlyToday[hr].ordersCount += 1;
        hourlyToday[hr].revenue += amount;
      }
    }

    // Table Occupancy
    let tablesTotal = 0;
    let tablesAvailable = 0;
    let tablesOccupied = 0;
    for (const grp of tableGroups) {
      const count = grp._count._all;
      tablesTotal += count;
      if (grp.status === TableStatus.AVAILABLE) tablesAvailable = count;
      if (grp.status === TableStatus.OCCUPIED) tablesOccupied = count;
    }

    // Low Stock Ingredients
    const lowStockItems = ingredients
      .filter((ing) => Number(ing.currentStock) <= Number(ing.reorderLevel))
      .map((ing) => ({
        id: ing.id,
        sku: ing.sku,
        name: ing.name,
        unit: ing.unit,
        currentStock: Number(ing.currentStock),
        reorderLevel: Number(ing.reorderLevel),
      }));

    // Top 5 Selling Items
    const itemMap = new Map<
      string,
      { menuItemId: string; itemName: string; quantitySold: number; revenue: number }
    >();
    for (const item of orderItems) {
      const existing = itemMap.get(item.menuItemId) ?? {
        menuItemId: item.menuItemId,
        itemName: item.itemName,
        quantitySold: 0,
        revenue: 0,
      };
      existing.quantitySold += item.quantity;
      existing.revenue += Number(item.subtotal);
      itemMap.set(item.menuItemId, existing);
    }

    const topItems = Array.from(itemMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((item) => ({
        ...item,
        revenue: round2(item.revenue),
        formattedRevenue: formatCurrencyAmount(item.revenue, currencyCode),
      }));

    const todayAov = todayOrders > 0 ? round2(todayRevenue / todayOrders) : 0;
    const periodAov = periodOrders > 0 ? round2(periodRevenue / periodOrders) : 0;

    const payload = {
      branchId,
      branchName: currencyConfig.branchName,
      generatedAt: now.toISOString(),
      cached: false,
      localization: {
        currency: currencyConfig.activeCurrency,
        language: languageConfig.activeLanguage,
      },
      today: {
        date: todayKey,
        ordersCount: todayOrders,
        cancelledCount: todayCancelled,
        revenue: round2(todayRevenue),
        formattedRevenue: formatCurrencyAmount(todayRevenue, currencyCode),
        averageOrderValue: todayAov,
        formattedAov: formatCurrencyAmount(todayAov, currencyCode),
      },
      period: {
        days,
        ordersCount: periodOrders,
        revenue: round2(periodRevenue),
        formattedRevenue: formatCurrencyAmount(periodRevenue, currencyCode),
        averageOrderValue: periodAov,
        formattedAov: formatCurrencyAmount(periodAov, currencyCode),
      },
      operations: {
        tablesTotal,
        tablesAvailable,
        tablesOccupied,
        tableOccupancyPercent:
          tablesTotal > 0 ? round2((tablesOccupied / tablesTotal) * 100) : 0,
        activeKitchenTickets,
        activeDeliveries,
        lowStockIngredientsCount: lowStockItems.length,
      },
      lowStockItems: lowStockItems.slice(0, 10),
      topItems,
      hourlySalesToday: hourlyToday.map((h) => ({
        ...h,
        revenue: round2(h.revenue),
      })),
      dailyTrend: Array.from(dailyMap.values()).map((d) => ({
        ...d,
        revenue: round2(d.revenue),
      })),
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        orderType: o.orderType,
        status: o.status,
        tableNumber: o.table?.tableNumber ?? null,
        customerName: o.customer
          ? `${o.customer.firstName} ${o.customer.lastName}`
          : null,
        totalAmount: Number(o.totalAmount),
        formattedTotal: formatCurrencyAmount(Number(o.totalAmount), currencyCode),
        createdAt: o.createdAt,
      })),
    };

    await cache.set(cacheKey, payload, DASHBOARD_CACHE_TTL_SECONDS);

    return payload;
  }
}

export const dashboardService = new DashboardService();

