import { Redis } from '@upstash/redis';
import { env } from './env';

let redis: Redis | null = null;

function getClient(): Redis | null {
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

export async function getCached<T>(key: string): Promise<T | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const value = await client.get<T>(key);
    return value ?? null;
  } catch (e) {
    console.warn(`[redis-cache] get failed for ${key}:`, e);
    return null;
  }
}

export async function setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    await client.set(key, value, { ex: ttlSeconds });
  } catch (e) {
    console.warn(`[redis-cache] set failed for ${key}:`, e);
  }
}
