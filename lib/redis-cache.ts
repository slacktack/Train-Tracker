import { Redis } from '@upstash/redis';
import { env } from './env';

let redis: Redis | null = null;

const memoryCache = new Map<string, { value: unknown; expiresAt: number }>();

export function getClient(): Redis | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!redis) {
    redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

// Keys can carry identifiers; log only the namespace.
const keyLabel = (key: string) => `${key.split(':')[0]}:*`;

export async function getCached<T>(key: string): Promise<T | null> {
  const client = getClient();
  if (client) {
    try {
      const value = await client.get<T>(key);
      return value ?? null;
    } catch (e) {
      console.warn(`[redis-cache] get failed for ${keyLabel(key)}:`, e);
      return null;
    }
  }
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export async function setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const client = getClient();
  if (client) {
    try {
      await client.set(key, value, { ex: ttlSeconds });
    } catch (e) {
      console.warn(`[redis-cache] set failed for ${keyLabel(key)}:`, e);
    }
    return;
  }
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}
