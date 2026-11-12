import { PaymentMethod } from '@prisma/client';

export interface CreateExpenseCategoryInput {
  branchId?: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateExpenseCategoryInput {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateExpenseInput {
  branchId?: string;
  categoryId: string;
  title: string;
  amount: number;
  method?: PaymentMethod;
  receiptUrl?: string;
  incurredAt?: string | Date;
  notes?: string;
  actorUserId?: string;
}

export interface UpdateExpenseInput {
  categoryId?: string;
  title?: string;
  amount?: number;
  method?: PaymentMethod;
  receiptUrl?: string;
  incurredAt?: string | Date;
  notes?: string;
  actorUserId?: string;
}

export interface DateRangeInput {
  branchId?: string;
  startDate?: string;
  endDate?: string;
}

