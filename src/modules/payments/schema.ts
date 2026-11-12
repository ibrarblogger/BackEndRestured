import { CashDrawerStatus, DiscountType, PaymentMethod, PaymentStatus } from '@prisma/client';
import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const paymentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const processPaymentSchema = z.object({
  branchId: z.string().uuid().optional(),
  orderId: z.string().uuid(),
  idempotencyKey: z.string().min(4).max(128).optional(),
  method: z.nativeEnum(PaymentMethod),
  amount: z.coerce.number().positive(),
  tipAmount: z.coerce.number().min(0).default(0),
  tenderedAmount: z.coerce.number().positive().optional(),
  cashDrawerSessionId: z.string().uuid().optional(),
  transactionRef: z.string().max(120).optional(),
  gatewayProvider: z.string().max(60).optional(),
  gatewayResponse: z.record(z.any()).optional(),
});

export const createRefundSchema = z.object({
  amount: z.coerce.number().positive(),
  reason: z.string().min(3).max(500),
  approvedBy: z.string().uuid().optional(),
});

export const openCashDrawerSchema = z.object({
  branchId: z.string().uuid().optional(),
  openingBalance: z.coerce.number().min(0),
  notes: z.string().max(500).optional(),
});

export const closeCashDrawerSchema = z.object({
  closingBalance: z.coerce.number().min(0),
  notes: z.string().max(500).optional(),
});

export const cashDrawerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().uuid().optional(),
  status: z.nativeEnum(CashDrawerStatus).optional(),
});

export const createTaxRateSchema = z.object({
  branchId: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  ratePercent: z.coerce.number().min(0).max(100),
  isInclusive: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const updateTaxRateSchema = createTaxRateSchema.partial();

export const createDiscountSchema = z.object({
  branchId: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  type: z.nativeEnum(DiscountType),
  value: z.coerce.number().positive(),
  minOrderAmount: z.coerce.number().min(0).default(0),
  maxDiscount: z.coerce.number().positive().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const updateDiscountSchema = createDiscountSchema.partial();

export const paymentWebhookSchema = z.object({
  provider: z.string().min(2).max(60).default('STRIPE'),
  eventType: z.string().min(2).max(100),
  idempotencyKey: z.string().min(4).max(128),
  orderId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  transactionRef: z.string().min(2).max(120),
  status: z.nativeEnum(PaymentStatus).default(PaymentStatus.COMPLETED),
  rawPayload: z.record(z.any()).optional(),
});

