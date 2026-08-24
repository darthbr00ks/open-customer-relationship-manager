import Redis from 'ioredis';

import { REDIS_URL } from './env';

const globalForRedis = globalThis as unknown as { redis?: Redis };

/**
 * Shared Redis connection for cache reads and writes.
 *
 * BullMQ needs its own connection options (see `queue.ts`) because workers hold
 * blocking commands open, which cannot share a client with ordinary traffic.
 */
export const redis: Redis = globalForRedis.redis ?? new Redis(REDIS_URL, { maxRetriesPerRequest: null });

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

/** Namespaced cache key so multiple environments can share one Redis instance. */
export const cacheKey = (...parts: string[]): string => ['open-rm', ...parts].join(':');
