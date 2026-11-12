import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';

export const auditLogQuerySchema = paginationQuerySchema.extend({
  userId: z.string().uuid().optional(),
  action: z.string().trim().optional(),
  entity: z.string().trim().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const auditLogIdParamSchema = z.object({
  id: z.string().uuid('Invalid audit log ID'),
});

