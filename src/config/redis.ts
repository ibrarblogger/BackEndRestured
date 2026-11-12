import { env } from './env';
import { logger } from './logger';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class CacheAdapter {
  private memoryStore = new Map<string, CacheEntry<any>>();

  async get<T>(key: string): Promise<T | null> {
    const item = this.memoryStore.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.memoryStore.delete(key);
      return null;
    }
    return item.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
    this.memoryStore.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(keyPrefix: string): Promise<void> {
    for (const key of this.memoryStore.keys()) {
      if (key === keyPrefix || key.startsWith(keyPrefix)) {
        this.memoryStore.delete(key);
      }
    }
  }

  async flush(): Promise<void> {
    this.memoryStore.clear();
  }
}

export const cache = new CacheAdapter();

export function isRedisConfigured(): boolean {
  return Boolean(env.REDIS_URL && env.REDIS_URL.trim().length > 0);
}

if (!isRedisConfigured()) {
  logger.info('REDIS_URL not set — using in-memory cache and in-memory background job runner');
}

