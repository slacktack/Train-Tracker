import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('redis-cache with no Redis configured', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('getCached returns null when env vars are unset', async () => {
    vi.doMock('./env', () => ({ env: { UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '' } }));
    const { getCached } = await import('./redis-cache');
    const result = await getCached('some-key');
    expect(result).toBeNull();
  });

  it('setCached resolves without throwing when env vars are unset', async () => {
    vi.doMock('./env', () => ({ env: { UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '' } }));
    const { setCached } = await import('./redis-cache');
    await expect(setCached('some-key', { a: 1 }, 60)).resolves.toBeUndefined();
  });
});
