import { NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/redis-cache';
import { UpstreamError } from '@/lib/sources/http';

export const isStationCode = (v: string | null): v is string => !!v && /^[A-Za-z0-9]{1,6}$/.test(v);
export const isStationOrCity = (v: string | null): v is string => !!v && /^~?[A-Za-z0-9]{1,6}$/.test(v);
export const isTrainNo = (v: string | null): v is string => !!v && /^\d{5}$/.test(v);
export const isIsoDate = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const isPnr = (v: string | null): v is string => !!v && /^\d{10}$/.test(v);

// "2026-10-10" -> "10-10-2026"
export function isoToDmy(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message, code: 'bad_request' }, { status: 400 });
}

export function upstreamFailure(err: unknown, label: string) {
  if (err instanceof UpstreamError) {
    const status = err.status === 404 ? 404 : 502;
    console.warn(`[${label}] ${err.message}`);
    return NextResponse.json({ error: err.message, provider: err.provider, code: status === 404 ? 'not_found' : 'upstream' }, { status });
  }
  console.error(`[${label}]`, err);
  return NextResponse.json({ error: 'Unexpected error', code: 'internal' }, { status: 500 });
}

export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const hit = await getCached<T>(key);
  if (hit) return hit;
  const value = await load();
  await setCached(key, value, ttlSeconds).catch(() => {});
  return value;
}
