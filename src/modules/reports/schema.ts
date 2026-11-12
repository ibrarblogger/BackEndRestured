import { z } from 'zod';

export const reportQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  format: z.enum(['json', 'csv', 'excel', 'pdf']).default('json'),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

