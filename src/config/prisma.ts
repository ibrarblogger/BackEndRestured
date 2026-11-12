import { PrismaClient } from '@prisma/client';
import { env } from './env';
import { logger } from './logger';
import { ServiceUnavailableError } from '../errors';

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ||
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

/**
 * Retries connecting to Supabase PostgreSQL if the free-tier database is paused or cold-starting.
 */
export async function connectDatabaseWithRetry(maxRetries = 4, delayMs = 2000): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      logger.info('✅ Connected to Supabase PostgreSQL via Prisma');
      return true;
    } catch (error) {
      logger.warn(
        { attempt, maxRetries, err: error instanceof Error ? error.message : String(error) },
        'Database connection attempt failed (Supabase may be cold-starting or unreachable)'
      );
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  logger.error('❌ Unable to reach Supabase PostgreSQL after retries.');
  return false;
}

/**
 * Helper to execute an operation with automatic retry on transient connection drop (cold start)
 * and throw a clean 503 ServiceUnavailableError if the DB remains unreachable.
 */
export async function withDbRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const isConnectionError =
        err?.code === 'P1001' ||
        err?.code === 'P1002' ||
        err?.code === 'P1008' ||
        err?.code === 'P1017' ||
        (typeof err?.message === 'string' &&
          (err.message.includes("Can't reach database server") ||
            err.message.includes('Connection terminated') ||
            err.message.includes('ECONNREFUSED')));

      if (!isConnectionError) {
        throw err;
      }

      if (i < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }
  logger.error({ err: lastError }, 'Database unreachable after retries');
  throw new ServiceUnavailableError(
    'Database is temporarily unreachable or waking up from sleep. Please try again in a few moments.'
  );
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Prisma disconnected cleanly');
  } catch (err) {
    logger.error({ err }, 'Error disconnecting Prisma');
  }
}
