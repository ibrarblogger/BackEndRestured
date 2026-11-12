import { z } from 'zod';
import { paginationQuerySchema } from '../../utils/pagination';

export const idParamSchema = z.object({
  id: z.string().uuid('Valid UUID is required'),
});

export const categoryQuerySchema = paginationQuerySchema.extend({
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const createCategorySchema = z.object({
  branchId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url().optional(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const updateCategorySchema = createCategorySchema.partial();

export const variantInputSchema = z.object({
  name: z.string().min(1).max(80),
  sku: z.string().min(1).max(50),
  priceDelta: z.coerce.number().default(0),
  isDefault: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
});

export const addOnInputSchema = z.object({
  name: z.string().min(1).max(80),
  price: z.coerce.number().min(0),
  isAvailable: z.boolean().default(true),
});

export const menuItemQuerySchema = paginationQuerySchema.extend({
  categoryId: z.string().uuid().optional(),
  station: z.string().optional(),
  isAvailable: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  isVegetarian: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const createMenuItemSchema = z.object({
  branchId: z.string().uuid().optional(),
  categoryId: z.string().uuid('Valid categoryId is required'),
  sku: z.string().min(1).max(50).transform((v) => v.toUpperCase().trim()),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  price: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0).default(0),
  imageUrl: z.string().url().optional(),
  station: z.string().min(1).max(50).default('MAIN_KITCHEN'),
  prepTimeMinutes: z.coerce.number().int().min(1).max(240).default(15),
  calories: z.coerce.number().int().min(0).optional(),
  isVegetarian: z.boolean().default(false),
  isVegan: z.boolean().default(false),
  isGlutenFree: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
  daypartSchedule: z
    .object({
      breakfast: z.boolean().optional(),
      lunch: z.boolean().optional(),
      dinner: z.boolean().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
    })
    .passthrough()
    .optional(),
  variants: z.array(variantInputSchema).optional(),
  addOns: z.array(addOnInputSchema).optional(),
});

export const updateMenuItemSchema = createMenuItemSchema.partial();

export const toggleAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});

export const updateDaypartSchema = z.object({
  daypartSchedule: z.record(z.any()),
});

export const createComboSchema = z.object({
  branchId: z.string().uuid().optional(),
  sku: z.string().min(1).max(50).transform((v) => v.toUpperCase().trim()),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  price: z.coerce.number().min(0),
  imageUrl: z.string().url().optional(),
  isAvailable: z.boolean().default(true),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1).default(1),
      })
    )
    .min(1, 'Combo must include at least one menu item'),
});

export const updateComboSchema = createComboSchema.partial();

