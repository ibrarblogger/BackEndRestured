import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid notification UUID'),
});

export const notificationQuerySchema = paginationQuerySchema.extend({
  branchId: z.string().uuid().optional(),
  unreadOnly: z.coerce.boolean().optional(),
  type: z.string().trim().max(40).optional(),
});

export const createNotificationSchema = z.object({
  branchId: z.string().uuid().optional(),
  userId: z.string().uuid().nullable().optional(),
  type: z.string().trim().min(2).max(40).default('SYSTEM'),
  title: z.string().trim().min(2).max(160),
  message: z.string().trim().min(2).max(1000),
  data: z.record(z.unknown()).optional(),
});

export const updatePreferencesSchema = z.object({
  branchId: z.string().uuid().optional(),
  orderNew: z.boolean().optional(),
  kitchenReady: z.boolean().optional(),
  stockLow: z.boolean().optional(),
  reservationNew: z.boolean().optional(),
  systemAlerts: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
});

