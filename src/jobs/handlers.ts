import { OrderStatus } from '@prisma/client';
import { logger } from '../config/logger';
import { prisma } from '../config/prisma';
import { formatCurrencyAmount } from '../constants/currencies';
import { notificationsService } from '../modules/notifications/service';
import { emitSocketEvent, SOCKET_EVENTS } from '../sockets';
import { jobQueue } from './queue';

let handlersRegistered = false;

export function registerBackgroundJobHandlers(): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  jobQueue.registerHandler('CRM_CAMPAIGN', async (payload) => {
    const branchId = payload.branchId ? String(payload.branchId) : undefined;
    const campaignName = String(payload.campaignName || 'CRM Campaign');
    const channel = String(payload.channel || 'EMAIL');
    const recipientCount = Number(payload.recipientCount || 0);

    logger.info(
      `[Job:CRM_CAMPAIGN] Processed "${campaignName}" via ${channel} for ${recipientCount} recipients`
    );

    const notification = await notificationsService.createAndEmit({
      branchId,
      type: 'SYSTEM',
      title: `CRM Campaign Sent: ${campaignName}`,
      message: `Dispatched ${channel} campaign to ${recipientCount} target customers.`,
      data: {
        campaignName,
        channel,
        recipientCount,
      },
    });

    return {
      processed: true,
      recipientCount,
      notificationId: notification.id,
    };
  });

  jobQueue.registerHandler('LOW_STOCK_SCAN', async (payload) => {
    const branchId = payload.branchId ? String(payload.branchId) : undefined;
    const ingredients = await prisma.ingredient.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(branchId ? { branchId } : {}),
      },
      select: {
        id: true,
        branchId: true,
        sku: true,
        name: true,
        unit: true,
        currentStock: true,
        reorderLevel: true,
      },
    });

    const lowStock = ingredients.filter(
      (i) => Number(i.currentStock) <= Number(i.reorderLevel)
    );

    if (lowStock.length > 0) {
      const targetBranchId = branchId || lowStock[0].branchId;
      emitSocketEvent(
        SOCKET_EVENTS.STOCK_LOW,
        {
          count: lowStock.length,
          items: lowStock.slice(0, 10).map((i) => ({
            id: i.id,
            sku: i.sku,
            name: i.name,
            currentStock: Number(i.currentStock),
            reorderLevel: Number(i.reorderLevel),
            unit: i.unit,
          })),
        },
        { branchId: targetBranchId }
      );

      await notificationsService.createAndEmit({
        branchId: targetBranchId,
        type: 'STOCK_LOW',
        title: `Low Stock Alert (${lowStock.length} items)`,
        message: `${lowStock
          .slice(0, 3)
          .map((i) => i.name)
          .join(', ')}${lowStock.length > 3 ? '...' : ''} at or below reorder threshold.`,
        data: { count: lowStock.length },
      });
    }

    return { scanned: ingredients.length, lowStockCount: lowStock.length };
  });

  jobQueue.registerHandler('DAILY_CLOSING_DIGEST', async (payload) => {
    const branchId = payload.branchId ? String(payload.branchId) : undefined;
    const branch = branchId
      ? await prisma.branch.findUnique({ where: { id: branchId } })
      : await prisma.branch.findFirst({ where: { deletedAt: null, isActive: true } });

    if (!branch) {
      return { skipped: true, reason: 'No active branch found' };
    }

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const orders = await prisma.order.findMany({
      where: {
        branchId: branch.id,
        deletedAt: null,
        status: { not: OrderStatus.CANCELLED },
        createdAt: { gte: startOfDay },
      },
      select: { totalAmount: true },
    });

    const revenue = orders.reduce((s, o) => s + Number(o.totalAmount), 0);
    const formatted = formatCurrencyAmount(revenue, branch.currency);

    await notificationsService.createAndEmit({
      branchId: branch.id,
      type: 'SYSTEM',
      title: `Daily Closing Digest (${startOfDay.toISOString().slice(0, 10)})`,
      message: `${orders.length} orders processed today with ${formatted} revenue.`,
      data: { ordersCount: orders.length, revenue, currency: branch.currency },
    });

    return {
      branchId: branch.id,
      ordersCount: orders.length,
      revenue,
      currency: branch.currency,
    };
  });
}

