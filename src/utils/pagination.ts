import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().trim().optional(),
  sortBy: z.string().trim().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  branchId: z.string().uuid().optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function getPrismaPagination(query: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' }) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(200, Math.max(1, Number(query.limit || 20)));
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  return {
    page,
    limit,
    skip,
    take: limit,
    orderBy: { [sortBy]: sortOrder } as Record<string, 'asc' | 'desc'>,
  };
}

