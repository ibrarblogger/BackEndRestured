import { z } from 'zod';

export const dashboardQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  days: z.coerce.number().int().min(1).max(90).default(7),
  lang: z.string().trim().max(10).optional(),
  refresh: z.coerce.boolean().optional(),
});

