import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  CORS_ORIGINS: z
    .string()
    .min(1, 'CORS_ORIGINS is required')
    .transform((val) => val.split(',').map((s) => s.trim())),
  API_BASE_URL: z.string().url('API_BASE_URL must be a valid URL'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL (Supabase transaction pooler) is required'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL (Supabase session/direct connection) is required'),

  SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  SUPABASE_SECRET_KEY: z.string().optional().or(z.literal('')),

  JWT_ACCESS_SECRET: z
    .string()
    .min(16, 'JWT_ACCESS_SECRET must be at least 16 characters long'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, 'JWT_REFRESH_SECRET must be at least 16 characters long'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),

  REDIS_URL: z.string().optional().or(z.literal('')),

  SEED_ADMIN_EMAIL: z.string().email('SEED_ADMIN_EMAIL must be a valid email'),
  SEED_ADMIN_PASSWORD: z
    .string()
    .min(8, 'SEED_ADMIN_PASSWORD must be at least 8 characters long'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;

