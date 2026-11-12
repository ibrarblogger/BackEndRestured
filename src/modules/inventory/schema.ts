import { StockMovementType } from '@prisma/client';
import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const menuItemIdParamSchema = z.object({
  menuItemId: z.string().uuid(),
});

export const ingredientQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  branchId: z.string().uuid().optional(),
  search: z.string().optional(),
  lowStockOnly: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

export const createIngredientSchema = z.object({
  branchId: z.string().uuid().optional(),
  sku: z.string().min(1).max(60),
  name: z.string().min(1).max(150),
  unit: z.string().min(1).max(30),
  currentStock: z.coerce.number().min(0).default(0),
  reorderLevel: z.coerce.number().min(0).default(10),
  costPerUnit: z.coerce.number().min(0),
  expiryDate: z.string().datetime().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const updateIngredientSchema = createIngredientSchema
  .omit({ currentStock: true })
  .partial();

export const upsertRecipeSchema = z.object({
  menuItemId: z.string().uuid(),
  instructions: z.string().max(2000).optional(),
  yieldQty: z.coerce.number().int().min(1).default(1),
  ingredients: z
    .array(
      z.object({
        ingredientId: z.string().uuid(),
        quantity: z.coerce.number().positive(),
      })
    )
    .min(1),
});

export const stockAdjustmentSchema = z.object({
  branchId: z.string().uuid().optional(),
  ingredientId: z.string().uuid(),
  type: z
    .nativeEnum(StockMovementType)
    .default(StockMovementType.MANUAL_ADJUSTMENT),
  quantityDelta: z.coerce.number().refine((v) => v !== 0, {
    message: 'quantityDelta cannot be 0',
  }),
  unitCost: z.coerce.number().min(0).optional(),
  referenceId: z.string().max(120).optional(),
  notes: z.string().min(2).max(500),
});

export const createWastageSchema = z.object({
  branchId: z.string().uuid().optional(),
  ingredientId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  reason: z.string().min(3).max(500),
});

export const stockTakeSchema = z.object({
  branchId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        ingredientId: z.string().uuid(),
        physicalCount: z.coerce.number().min(0),
        notes: z.string().max(300).optional(),
      })
    )
    .min(1),
});

export const stockMovementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  branchId: z.string().uuid().optional(),
  ingredientId: z.string().uuid().optional(),
  type: z.nativeEnum(StockMovementType).optional(),
});

export const wastageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  branchId: z.string().uuid().optional(),
  ingredientId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

