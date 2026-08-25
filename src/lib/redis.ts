import Redis from 'ioredis';

import { REDIS_URL } from './env';

const globalForRedis = globalThis as unknown as { redis?: Redis };

/** Returns the shared Redis connection for cache reads and writes. */
export function getRedis(): Redis {
  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  }
  return globalForRedis.redis;
}

/** Namespaced cache key so multiple environments can share one Redis instance. */
export const cacheKey = (...parts: string[]): string => ['open-rm', ...parts].join(':');
