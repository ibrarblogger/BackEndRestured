import { PaymentMethod } from '@prisma/client';
import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const createExpenseCategorySchema = z.object({
  branchId: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(400).optional(),
  isActive: z.boolean().default(true),
});

export const updateExpenseCategorySchema = createExpenseCategorySchema.partial();

export const expenseQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
});

export const createExpenseSchema = z.object({
  branchId: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  title: z.string().min(2).max(180),
  amount: z.coerce.number().positive(),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  receiptUrl: z.string().url().optional(),
  incurredAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const accountingQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  date: z.string().optional(), // For daily closing YYYY-MM-DD
});

