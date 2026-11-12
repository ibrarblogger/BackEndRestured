import { PaymentMethod, PurchaseOrderStatus } from '@prisma/client';
import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const supplierQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().uuid().optional(),
  search: z.string().optional(),
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

export const createSupplierSchema = z.object({
  branchId: z.string().uuid().optional(),
  name: z.string().min(1).max(150),
  contactPerson: z.string().max(120).optional(),
  phone: z.string().min(3).max(40),
  email: z.string().email().optional(),
  address: z.string().max(500).optional(),
  taxId: z.string().max(80).optional(),
  isActive: z.boolean().default(true),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export const purchaseOrderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  branchId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  status: z.nativeEnum(PurchaseOrderStatus).optional(),
});

export const createPurchaseOrderSchema = z.object({
  branchId: z.string().uuid().optional(),
  supplierId: z.string().uuid(),
  expectedDate: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  status: z
    .enum([PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.ORDERED])
    .default(PurchaseOrderStatus.ORDERED),
  items: z
    .array(
      z.object({
        ingredientId: z.string().uuid(),
        orderedQty: z.coerce.number().positive(),
        unitCost: z.coerce.number().min(0),
      })
    )
    .min(1),
});

export const updatePurchaseOrderStatusSchema = z.object({
  status: z.nativeEnum(PurchaseOrderStatus),
});

export const receiveGoodsSchema = z.object({
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        ingredientId: z.string().uuid(),
        receivedQty: z.coerce.number().positive(),
        unitCost: z.coerce.number().min(0).optional(),
        expiryDate: z.string().datetime().optional(),
        batchNo: z.string().max(80).optional(),
      })
    )
    .min(1),
});

export const createSupplierPaymentSchema = z.object({
  branchId: z.string().uuid().optional(),
  supplierId: z.string().uuid(),
  purchaseOrderId: z.string().uuid().optional(),
  amount: z.coerce.number().positive(),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  referenceNo: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
});

