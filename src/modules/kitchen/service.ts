import { KitchenTicketStatus } from '@prisma/client';
import { NotFoundError } from '../../errors';
import { emitSocketEvent, SOCKET_EVENTS } from '../../sockets';
import { kitchenRepository } from './repository';
import { KitchenTicketFilterQuery } from './types';

export class KitchenService {
  private enrichTicketWithPrepTimer(ticket: any) {
    const startRef = ticket.startedAt ? new Date(ticket.startedAt) : new Date(ticket.createdAt);
    const endRef = ticket.readyAt ? new Date(ticket.readyAt) : new Date();
    const elapsedMinutes = Math.max(
      0,
      Math.round(((endRef.getTime() - startRef.getTime()) / 60000) * 10) / 10
    );
    const isOverdue =
      ticket.status !== KitchenTicketStatus.READY &&
      ticket.status !== KitchenTicketStatus.SERVED &&
      elapsedMinutes > (ticket.prepTimeTargetMin || 15);

    return {
      ...ticket,
      elapsedMinutes,
      isOverdue,
    };
  }

  async listTickets(query: KitchenTicketFilterQuery) {
    const { items, meta } = await kitchenRepository.findManyTickets(query);
    return {
      items: items.map((t) => this.enrichTicketWithPrepTimer(t)),
      meta,
    };
  }

  async getTicketById(id: string) {
    const ticket = await kitchenRepository.findTicketById(id);
    if (!ticket) throw new NotFoundError('Kitchen ticket');
    return this.enrichTicketWithPrepTimer(ticket);
  }

  async getStationsSummary(branchId?: string) {
    return kitchenRepository.getStationsSummary(branchId);
  }

  async updateTicketStatus(
    id: string,
    status: KitchenTicketStatus,
    actorUserId?: string
  ) {
    await this.getTicketById(id);
    const { ticket, newOrderStatus, previousOrderStatus } =
      await kitchenRepository.updateTicketStatusTransaction(id, status, actorUserId);

    const enriched = this.enrichTicketWithPrepTimer(ticket);

    if (status === KitchenTicketStatus.READY) {
      emitSocketEvent(SOCKET_EVENTS.KITCHEN_TICKET_READY, enriched, {
        branchId: ticket.branchId,
      });
    }

    if (newOrderStatus) {
      emitSocketEvent(
        SOCKET_EVENTS.ORDER_STATUS_CHANGED,
        {
          orderId: ticket.orderId,
          orderNumber: ticket.order.orderNumber,
          previousStatus: previousOrderStatus,
          status: newOrderStatus,
        },
        { branchId: ticket.branchId }
      );
    }

    return enriched;
  }
}

export const kitchenService = new KitchenService();

