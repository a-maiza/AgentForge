import { Redis } from 'ioredis';

const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

/** Shared read/write client */
export const redis = new Redis(redisUrl, { lazyConnect: true });

/** Dedicated publishing client (Redis requires separate connection for PUBLISH) */
export const publisher = new Redis(redisUrl, { lazyConnect: true });

export async function connectRedis(): Promise<void> {
  await redis.connect();
  await publisher.connect();
}

// TTLs (seconds)
export const PROMPT_CACHE_TTL = 30;
export const AUTH_CACHE_TTL = 60;
