import { readDisk, writeDisk } from './disk-cache';
import { fetchRaw, UpstreamError } from './http';
import type { RjRow } from './rj-map';

const URL = 'https://media.railjournal.in/rail-data/markers/current-web.txt?schema=web-v1';
const FILE = 'rj-snapshot.json';
// Their own client polls every 60s; the CDN object is cacheable for 30s.
const MIN_INTERVAL_MS = 60_000;
const MAX_AGE_MS = 20 * 60_000;
const MIN_COUNT = 500;

export interface RjSnapshot {
  fetchedAt: number;
  timestamp: string;
  rows: RjRow[];
}

let memory: RjSnapshot | null = null;
let inflight: Promise<RjSnapshot | null> | null = null;

export function snapshotEnabled(): boolean {
  return process.env.RAILJOURNAL_SNAPSHOT !== 'off';
}

// "2026-10-03 17:41:34" (IST) -> epoch ms
function parseStamp(ts: string): number {
  return Date.parse(ts.replace(' ', 'T') + '+05:30');
}

function usable(s: RjSnapshot | null): s is RjSnapshot {
  return !!s && Date.now() - parseStamp(s.timestamp) < MAX_AGE_MS && s.rows.length >= MIN_COUNT;
}

async function pull(): Promise<RjSnapshot> {
  const res = await fetchRaw('railjournal', URL, { headers: { Accept: 'application/json' }, timeoutMs: 15_000 });
  if (!res.ok) throw new UpstreamError('railjournal', `snapshot HTTP ${res.status}`, res.status);
  const json = (await res.json()) as { status?: boolean; timestamp?: string; data?: RjRow[] };
  if (!json.status || !json.timestamp || !Array.isArray(json.data)) throw new UpstreamError('railjournal', 'malformed snapshot');
  return { fetchedAt: Date.now(), timestamp: json.timestamp, rows: json.data };
}

/** Fresh open-CDN snapshot, or null when disabled/unavailable/stale (caller falls back). */
export async function getRjSnapshot(): Promise<RjSnapshot | null> {
  if (!snapshotEnabled()) return null;
  memory ??= readDisk<RjSnapshot>(FILE);
  if (memory && Date.now() - memory.fetchedAt < MIN_INTERVAL_MS && usable(memory)) return memory;

  inflight ??= pull()
    .then((next) => {
      if (!usable(next)) throw new UpstreamError('railjournal', 'snapshot is stale or too small');
      memory = next;
      writeDisk(FILE, next);
      return next;
    })
    .catch((err) => {
      console.warn('[rj-snapshot]', err instanceof Error ? err.message : err);
      return null;
    })
    .finally(() => {
      inflight = null;
    });

  const next = await inflight;
  if (next) return next;
  return usable(memory) ? memory : null;
}
