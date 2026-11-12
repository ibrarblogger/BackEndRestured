import { DiscountType } from '@prisma/client';
import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const customerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().uuid().optional(),
  search: z.string().optional(),
  segment: z.string().optional(),
  tier: z.string().optional(),
});

export const createCustomerSchema = z.object({
  branchId: z.string().uuid().optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().min(3).max(40),
  email: z.string().email().optional(),
  segment: z.enum(['NEW', 'REGULAR', 'VIP', 'AT_RISK']).default('NEW'),
  notes: z.string().max(1000).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const earnRedeemPointsSchema = z.object({
  orderId: z.string().uuid().optional(),
  points: z.coerce.number().int().positive(),
  description: z.string().max(300).optional(),
});

export const createCouponSchema = z.object({
  branchId: z.string().uuid().optional(),
  code: z
    .string()
    .min(2)
    .max(40)
    .transform((v) => v.trim().toUpperCase()),
  description: z.string().max(300).optional(),
  type: z.nativeEnum(DiscountType),
  value: z.coerce.number().positive(),
  minOrderAmount: z.coerce.number().min(0).default(0),
  maxDiscount: z.coerce.number().positive().nullable().optional(),
  usageLimit: z.coerce.number().int().positive().nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const updateCouponSchema = createCouponSchema.partial();

export const validateCouponSchema = z.object({
  branchId: z.string().uuid().optional(),
  code: z
    .string()
    .min(2)
    .max(40)
    .transform((v) => v.trim().toUpperCase()),
  orderSubtotal: z.coerce.number().positive(),
});

export const createFeedbackSchema = z.object({
  branchId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  rating: z.coerce.number().int().min(1).max(5),
  foodRating: z.coerce.number().int().min(1).max(5).optional(),
  serviceRating: z.coerce.number().int().min(1).max(5).optional(),
  comment: z.string().max(1000).optional(),
});

export const feedbackQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().uuid().optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  isResolved: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

export const triggerCampaignSchema = z.object({
  branchId: z.string().uuid().optional(),
  name: z.string().min(2).max(150),
  channel: z.enum(['EMAIL', 'SMS', 'BOTH']).default('EMAIL'),
  segment: z.enum(['NEW', 'REGULAR', 'VIP', 'AT_RISK']).optional(),
  tier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']).optional(),
  subject: z.string().max(200).optional(),
  messageTemplate: z.string().min(5).max(2000),
  couponCode: z.string().max(40).optional(),
});

