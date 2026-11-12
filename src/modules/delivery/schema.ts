import { DeliveryStatus } from '@prisma/client';
import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid UUID'),
});

export const zoneQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const createZoneSchema = z.object({
  branchId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(100),
  deliveryFee: z.coerce.number().min(0),
  minOrderAmount: z.coerce.number().min(0).default(0),
  estimatedTimeMin: z.coerce.number().int().min(5).max(300).default(30),
  isActive: z.boolean().default(true),
});

export const updateZoneSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  deliveryFee: z.coerce.number().min(0).optional(),
  minOrderAmount: z.coerce.number().min(0).optional(),
  estimatedTimeMin: z.coerce.number().int().min(5).max(300).optional(),
  isActive: z.boolean().optional(),
});

export const riderQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  status: z.enum(['AVAILABLE', 'BUSY', 'OFFLINE']).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const createRiderSchema = z.object({
  branchId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(6).max(30),
  vehicleNo: z.string().trim().max(40).optional(),
  status: z.enum(['AVAILABLE', 'BUSY', 'OFFLINE']).default('AVAILABLE'),
  isActive: z.boolean().default(true),
});

export const updateRiderSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().min(6).max(30).optional(),
  vehicleNo: z.string().trim().max(40).optional(),
  status: z.enum(['AVAILABLE', 'BUSY', 'OFFLINE']).optional(),
  isActive: z.boolean().optional(),
});

export const deliveryQuerySchema = paginationQuerySchema.extend({
  branchId: z.string().uuid().optional(),
  status: z.nativeEnum(DeliveryStatus).optional(),
  riderId: z.string().uuid().optional(),
  zoneId: z.string().uuid().optional(),
});

export const dispatchDeliverySchema = z.object({
  branchId: z.string().uuid().optional(),
  orderId: z.string().uuid(),
  zoneId: z.string().uuid().optional(),
  riderId: z.string().uuid().optional(),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(6).max(30),
  deliveryAddress: z.string().trim().min(5).max(500),
  deliveryFee: z.coerce.number().min(0).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const assignRiderSchema = z.object({
  riderId: z.string().uuid(),
});

export const updateDeliveryStatusSchema = z.object({
  status: z.nativeEnum(DeliveryStatus),
  notes: z.string().trim().max(500).optional(),
});

