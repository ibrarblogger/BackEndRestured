import { DeliveryStatus, KitchenTicketStatus, OrderStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';

export class DashboardRepository {
  async findDefaultBranchId(): Promise<string | undefined> {
    const branch = await prisma.branch.findFirst({
      where: { deletedAt: null, isActive: true },
      select: { id: true },
    });
    return branch?.id;
  }

  async findOrdersSince(branchId: string, sinceDate: Date) {
    return prisma.order.findMany({
      where: {
        branchId,
        deletedAt: null,
        createdAt: { gte: sinceDate },
      },
      select: {
        id: true,
        orderNumber: true,
        orderType: true,
        status: true,
        totalAmount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findTablesBreakdown(branchId: string) {
    return prisma.table.groupBy({
      by: ['status'],
      where: { branchId, deletedAt: null, isActive: true },
      _count: { _all: true },
    });
  }

  async countActiveKitchenTickets(branchId: string) {
    return prisma.kitchenTicket.count({
      where: {
        branchId,
        status: {
          in: [
            KitchenTicketStatus.QUEUED,
            KitchenTicketStatus.PREPARING,
            KitchenTicketStatus.READY,
          ],
        },
      },
    });
  }

  async countActiveDeliveries(branchId: string) {
    return prisma.delivery.count({
      where: {
        branchId,
        status: {
          in: [
            DeliveryStatus.PENDING,
            DeliveryStatus.ASSIGNED,
            DeliveryStatus.PICKED_UP,
            DeliveryStatus.IN_TRANSIT,
          ],
        },
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
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        currentStock: true,
        reorderLevel: true,
      },
      orderBy: { currentStock: 'asc' },
    });
  }

  async findOrderItemsSince(branchId: string, sinceDate: Date) {
    return prisma.orderItem.findMany({
      where: {
        order: {
          branchId,
          deletedAt: null,
          status: { not: OrderStatus.CANCELLED },
          createdAt: { gte: sinceDate },
        },
      },
      select: {
        menuItemId: true,
        itemName: true,
        quantity: true,
        subtotal: true,
      },
    });
  }

  async findRecentOrders(branchId: string, take = 10) {
    return prisma.order.findMany({
      where: {
        branchId,
        deletedAt: null,
      },
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        orderType: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        table: { select: { tableNumber: true } },
        customer: { select: { firstName: true, lastName: true } },
      },
    });
  }
}

export const dashboardRepository = new DashboardRepository();

