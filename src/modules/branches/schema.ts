import { z } from 'zod';
import { SUPPORTED_CURRENCY_CODES } from '../../constants/currencies';
import { SUPPORTED_LANGUAGE_CODES } from '../../constants/languages';
import { paginationQuerySchema } from '../../utils/pagination';

export const branchQuerySchema = paginationQuerySchema.extend({
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const branchIdParamSchema = z.object({
  id: z.string().uuid('Valid branch ID is required'),
});

export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(
    (code) => (SUPPORTED_CURRENCY_CODES as readonly string[]).includes(code),
    {
      message: `Unsupported currency code. Supported currencies: ${SUPPORTED_CURRENCY_CODES.join(', ')}`,
    }
  );

export const updateCurrencySchema = z.object({
  currency: currencyCodeSchema,
  branchId: z.string().uuid().optional(),
  applyToAllBranches: z.boolean().default(true),
});

export const languageCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(
    (code) => (SUPPORTED_LANGUAGE_CODES as readonly string[]).includes(code),
    {
      message: `Unsupported language code. Supported languages: ${SUPPORTED_LANGUAGE_CODES.join(', ')}`,
    }
  );

export const updateLanguageSchema = z.object({
  language: languageCodeSchema,
  branchId: z.string().uuid().optional(),
  applyToAllBranches: z.boolean().default(true),
});

export const createBranchSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20).transform((v) => v.toUpperCase().trim()),
  address: z.string().min(5).max(255),
  phone: z.string().min(5).max(30),
  email: z.string().email().optional(),
  currency: currencyCodeSchema.default('PKR'),
  timezone: z.string().default('Asia/Karachi'),
  taxRatePercent: z.coerce.number().min(0).max(100).default(10),
  serviceChargePercent: z.coerce.number().min(0).max(100).default(5),
  orderNumberPrefix: z.string().min(1).max(10).default('ORD'),
  receiptHeader: z.string().max(500).optional(),
  receiptFooter: z.string().max(500).optional(),
  businessHours: z.record(z.any()).optional(),
  isActive: z.boolean().default(true),
});

export const updateBranchSchema = createBranchSchema.partial();

export const upsertBranchSettingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.any(),
  group: z.string().default('GENERAL'),
});
