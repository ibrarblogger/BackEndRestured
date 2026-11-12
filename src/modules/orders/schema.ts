import { OrderStatus, OrderType } from '@prisma/client';
import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';

export const idParamSchema = z.object({
  id: z.string().uuid('Valid order ID is required'),
});

export const orderQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(OrderStatus).optional(),
  orderType: z.nativeEnum(OrderType).optional(),
  tableId: z.string().uuid().optional(),
  waiterId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const orderItemInputSchema = z.object({
  menuItemId: z.string().uuid('Valid menuItemId is required'),
  variantId: z.string().uuid().optional(),
  quantity: z.coerce.number().int().min(1).max(500),
  notes: z.string().max(300).optional(),
  modifiers: z
    .array(
      z.object({
        addOnId: z.string().uuid('Valid addOnId is required'),
        quantity: z.coerce.number().int().min(1).default(1),
      })
    )
    .optional(),
});

export const createOrderSchema = z.object({
  branchId: z.string().uuid().optional(),
  tableId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  waiterId: z.string().uuid().optional(),
  orderType: z.nativeEnum(OrderType).default(OrderType.DINE_IN),
  guestCount: z.coerce.number().int().min(1).max(100).default(1),
  items: z.array(orderItemInputSchema).min(1, 'Order must contain at least one item'),
  discountId: z.string().uuid().optional(),
  couponCode: z.string().max(50).optional(),
  deliveryFee: z.coerce.number().min(0).default(0),
  tipAmount: z.coerce.number().min(0).default(0),
  notes: z.string().max(500).optional(),
  holdImmediately: z.boolean().default(false),
});

export const updateOrderSchema = z.object({
  tableId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  guestCount: z.coerce.number().int().min(1).max(100).optional(),
  discountId: z.string().uuid().nullable().optional(),
  couponCode: z.string().max(50).nullable().optional(),
  deliveryFee: z.coerce.number().min(0).optional(),
  tipAmount: z.coerce.number().min(0).optional(),
  notes: z.string().max(500).optional(),
  items: z.array(orderItemInputSchema).min(1).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(3, 'Cancellation reason is required').max(500),
});

export const splitOrderSchema = z.object({
  orderItemIds: z
    .array(z.string().uuid())
    .min(1, 'Specify at least one orderItemId to split into a new bill'),
  guestCount: z.coerce.number().int().min(1).default(1),
});

export const mergeOrdersSchema = z.object({
  targetOrderId: z.string().uuid('Valid targetOrderId is required'),
  sourceOrderIds: z
    .array(z.string().uuid())
    .min(1, 'Specify at least one sourceOrderId to merge'),
});

