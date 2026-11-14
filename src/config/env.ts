import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const resolvedBaseUrl =
  process.env.API_BASE_URL ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:${process.env.PORT || 5000}`);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  CORS_ORIGINS: z
    .string()
    .default('*')
    .transform((val) => val.split(',').map((s) => s.trim())),
  API_BASE_URL: z.string().default(resolvedBaseUrl),

  DATABASE_URL: z
    .string()
    .default(process.env.DATABASE_URL || ''),
  DIRECT_URL: z
    .string()
    .default(process.env.DIRECT_URL || process.env.DATABASE_URL || ''),

  SUPABASE_URL: z.string().optional().default(''),
  SUPABASE_SECRET_KEY: z.string().optional().default(''),

  JWT_ACCESS_SECRET: z
    .string()
    .min(16, 'JWT_ACCESS_SECRET must be at least 16 characters long')
    .default('fallback_jwt_access_secret_at_least_32_chars_long'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, 'JWT_REFRESH_SECRET must be at least 16 characters long')
    .default('fallback_jwt_refresh_secret_at_least_32_chars_long'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),

  REDIS_URL: z.string().optional().default(''),

  SEED_ADMIN_EMAIL: z.string().email().default('admin@rms-enterprise.local'),
  SEED_ADMIN_PASSWORD: z
    .string()
    .min(8)
    .default('Admin@123456!'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  }
}

if (!process.env.DATABASE_URL) {
  console.warn(
    '⚠️ [WARNING] DATABASE_URL is not set in environment variables! Please set DATABASE_URL in Vercel Project Settings -> Environment Variables.'
  );
}

export const env = parsed.success ? parsed.data : (envSchema.parse({}) as z.infer<typeof envSchema>);
export type Env = z.infer<typeof envSchema>;
