import { KitchenTicketStatus, OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { getPrismaPagination } from '../../utils/pagination';
import { KitchenTicketFilterQuery } from './types';

export class KitchenRepository {
  async findManyTickets(query: KitchenTicketFilterQuery) {
    const { page, limit, skip, take } = getPrismaPagination(query);

    const where: Prisma.KitchenTicketWhereInput = {};
    if (query.branchId) where.branchId = query.branchId;
    if (query.station) where.station = query.station;
    if (query.status) {
      where.status = query.status;
    } else {
      where.status = {
        in: [
          KitchenTicketStatus.QUEUED,
          KitchenTicketStatus.PREPARING,
          KitchenTicketStatus.READY,
        ],
      };
    }
    if (query.orderId) where.orderId = query.orderId;

    const [items, total] = await Promise.all([
      prisma.kitchenTicket.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'asc' },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              orderType: true,
              status: true,
              notes: true,
              table: { select: { id: true, tableNumber: true } },
              waiter: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.kitchenTicket.count({ where }),
    ]);

    return { items, meta: { page, limit, total } };
  }

  async findTicketById(id: string) {
    return prisma.kitchenTicket.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            orderType: true,
            status: true,
            notes: true,
            table: { select: { id: true, tableNumber: true } },
            waiter: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async getStationsSummary(branchId?: string) {
    const grouped = await prisma.kitchenTicket.groupBy({
      by: ['station', 'status'],
      where: {
        ...(branchId ? { branchId } : {}),
        status: {
          in: [
            KitchenTicketStatus.QUEUED,
            KitchenTicketStatus.PREPARING,
            KitchenTicketStatus.READY,
          ],
        },
      },
      _count: { _all: true },
    });

    const summaryMap = new Map<
      string,
      { station: string; queued: number; preparing: number; ready: number; totalActive: number }
    >();

    for (const row of grouped) {
      const entry = summaryMap.get(row.station) || {
        station: row.station,
        queued: 0,
        preparing: 0,
        ready: 0,
        totalActive: 0,
      };
      const count = row._count._all;
      if (row.status === KitchenTicketStatus.QUEUED) entry.queued += count;
      if (row.status === KitchenTicketStatus.PREPARING) entry.preparing += count;
      if (row.status === KitchenTicketStatus.READY) entry.ready += count;
      entry.totalActive += count;
      summaryMap.set(row.station, entry);
    }

    return Array.from(summaryMap.values());
  }

  async updateTicketStatusTransaction(
    ticketId: string,
    status: KitchenTicketStatus,
    actorUserId?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const ticket = await tx.kitchenTicket.update({
        where: { id: ticketId },
        data: {
          status,
          startedAt: status === KitchenTicketStatus.PREPARING ? now : undefined,
          readyAt: status === KitchenTicketStatus.READY ? now : undefined,
          servedAt: status === KitchenTicketStatus.SERVED ? now : undefined,
        },
        include: {
          order: {
            select: {
              id: true,
              branchId: true,
              orderNumber: true,
              status: true,
            },
          },
        },
      });

      // Sync parent Order status based on all its KitchenTickets
      const siblingTickets = await tx.kitchenTicket.findMany({
        where: { orderId: ticket.orderId },
      });

      let newOrderStatus: OrderStatus | null = null;

      if (
        status === KitchenTicketStatus.PREPARING &&
        ticket.order.status === OrderStatus.NEW
      ) {
        newOrderStatus = OrderStatus.PREPARING;
      } else if (
        siblingTickets.length > 0 &&
        siblingTickets.every(
          (t) =>
            t.status === KitchenTicketStatus.READY ||
            t.status === KitchenTicketStatus.SERVED
        ) &&
        (ticket.order.status === OrderStatus.NEW ||
          ticket.order.status === OrderStatus.PREPARING)
      ) {
        newOrderStatus = OrderStatus.READY;
      } else if (
        siblingTickets.length > 0 &&
        siblingTickets.every((t) => t.status === KitchenTicketStatus.SERVED) &&
        ticket.order.status !== OrderStatus.PAID
      ) {
        newOrderStatus = OrderStatus.SERVED;
      }

      if (newOrderStatus) {
        await tx.order.update({
          where: { id: ticket.orderId },
          data: {
            status: newOrderStatus,
            updatedBy: actorUserId,
          },
        });
      }

      return { ticket, newOrderStatus, previousOrderStatus: ticket.order.status };
    });
  }
}

export const kitchenRepository = new KitchenRepository();

