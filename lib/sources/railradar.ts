import { readDisk, writeDisk } from './disk-cache';
import { fetchRaw, UpstreamError } from './http';
import type { RadarRow } from './projection';

const BASE = 'https://api.railradar.in/v1';
const SNAPSHOT_FILE = 'railradar-snapshot.json';
const FREE_TIER_MONTHLY = 1000;
// 40 min between fetches is ~36/day; the hard reserve keeps room for ad-hoc calls.
const SNAPSHOT_TTL_MS = 40 * 60_000;
const MONTHLY_RESERVE = 120;

export interface RadarSnapshot {
  fetchedAt: number;
  timestamp: string;
  rows: RadarRow[];
  remainingMonth: number | null;
}

let memory: RadarSnapshot | null = null;
let inflight: Promise<RadarSnapshot | null> | null = null;

function apiKey(): string {
  return process.env.RAILRADAR_API_KEY ?? '';
}

function current(): RadarSnapshot | null {
  memory ??= readDisk<RadarSnapshot>(SNAPSHOT_FILE);
  return memory;
}

export function radarStatus(): { configured: boolean; remainingMonth: number | null; fetchedAt: number | null } {
  const snap = current();
  return { configured: !!apiKey(), remainingMonth: snap?.remainingMonth ?? null, fetchedAt: snap?.fetchedAt ?? null };
}

async function pull(): Promise<RadarSnapshot> {
  const res = await fetchRaw('railradar', `${BASE}/legacy/trains/live-map`, {
    headers: { 'X-API-Key': apiKey(), Accept: 'application/json' },
    timeoutMs: 20_000,
  });
  const remaining = Number(res.headers.get('x-ratelimit-remaining-month'));
  const text = await res.text();
  if (!res.ok) throw new UpstreamError('railradar', `HTTP ${res.status}`, res.status);
  const json = JSON.parse(text) as { success?: boolean; data?: RadarRow[]; meta?: { timestamp?: string } };
  if (!json.success || !Array.isArray(json.data) || json.data.length === 0) {
    throw new UpstreamError('railradar', 'empty live map');
  }
  return {
    fetchedAt: Date.now(),
    timestamp: json.meta?.timestamp ?? new Date().toISOString(),
    rows: json.data,
    remainingMonth: Number.isFinite(remaining) ? remaining : null,
  };
}

// Returns the cached snapshot unless it is stale AND the monthly budget allows a refetch.
export async function getRadarSnapshot(): Promise<{ snapshot: RadarSnapshot; stale: boolean }> {
  const snap = current();
  const fresh = snap && Date.now() - snap.fetchedAt < SNAPSHOT_TTL_MS;
  if (snap && fresh) return { snapshot: snap, stale: false };

  const budgetLeft = snap?.remainingMonth ?? FREE_TIER_MONTHLY;
  const canFetch = !!apiKey() && budgetLeft > MONTHLY_RESERVE;
  if (!canFetch) {
    if (snap) return { snapshot: snap, stale: true };
    throw new UpstreamError('railradar', apiKey() ? 'monthly budget exhausted' : 'RAILRADAR_API_KEY not set');
  }

  inflight ??= pull()
    .then((next) => {
      memory = next;
      writeDisk(SNAPSHOT_FILE, next);
      return next;
    })
    .catch((err) => {
      console.warn('[railradar] refresh failed:', err instanceof Error ? err.message : err);
      return null;
    })
    .finally(() => {
      inflight = null;
    });

  const next = await inflight;
  if (next) return { snapshot: next, stale: false };
  if (snap) return { snapshot: snap, stale: true };
  throw new UpstreamError('railradar', 'live map unavailable');
}
