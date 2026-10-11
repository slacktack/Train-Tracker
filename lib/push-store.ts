import { createHash } from 'crypto';
import type { PushSubscription } from 'web-push';
import { getClient } from '@/lib/redis-cache';
import type { Watch } from '@/lib/watch';

export interface PushRecord {
  subscription: PushSubscription;
  watches: Watch[];
  updatedAt: number;
}

const TTL_S = 14 * 86_400;
const INDEX = 'push:subs';
const memory = new Map<string, PushRecord>();

export const subId = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex').slice(0, 32);

export async function getRecord(id: string): Promise<PushRecord | null> {
  const r = getClient();
  if (!r) return memory.get(id) ?? null;
  return (await r.get<PushRecord>(`push:sub:${id}`)) ?? null;
}

export async function putRecord(id: string, rec: PushRecord): Promise<void> {
  const r = getClient();
  if (!r) {
    memory.set(id, rec);
    return;
  }
  await r.set(`push:sub:${id}`, rec, { ex: TTL_S });
  await r.sadd(INDEX, id);
}

export async function deleteRecord(id: string): Promise<void> {
  const r = getClient();
  if (!r) {
    memory.delete(id);
    return;
  }
  await r.del(`push:sub:${id}`);
  await r.srem(INDEX, id);
}

export async function allIds(): Promise<string[]> {
  const r = getClient();
  return r ? await r.smembers(INDEX) : Array.from(memory.keys());
}

// Server-side progress (last status, fired) wins over the client's copy of the same watch.
export function mergeWatches(incoming: Watch[], stored: Watch[] | undefined): Watch[] {
  const prev = new Map((stored ?? []).map((w) => [w.id, w]));
  return incoming.map((w) => {
    const p = prev.get(w.id);
    return p && p.kind === w.kind ? ({ ...w, ...p } as Watch) : w;
  });
}

export function pushConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}
