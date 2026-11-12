import { KitchenTicketStatus } from '@prisma/client';

export interface KitchenTicketFilterQuery {
  page?: number;
  limit?: number;
  branchId?: string;
  station?: string;
  status?: KitchenTicketStatus;
  orderId?: string;
}

export interface UpdateKitchenTicketStatusInput {
  status: KitchenTicketStatus;
  actorUserId?: string;
}

