import { KitchenTicketStatus } from '@prisma/client';
import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';

export const idParamSchema = z.object({
  id: z.string().uuid('Valid kitchen ticket ID is required'),
});

export const kitchenTicketQuerySchema = paginationQuerySchema.extend({
  station: z.string().trim().optional(),
  status: z.nativeEnum(KitchenTicketStatus).optional(),
  orderId: z.string().uuid().optional(),
});

export const updateKitchenTicketStatusSchema = z.object({
  status: z.nativeEnum(KitchenTicketStatus),
});

