// Alert watches: evaluated in the open app and by the push cron, so keep this pure.
import type { BoardRow } from '@/lib/sources/wimt';

export interface SeatWatch {
  kind: 'seat';
  id: string;
  train: string;
  trainName: string;
  from: string;
  to: string;
  // YYYY-MM-DD
  date: string;
  cls: string;
  quota: string;
  lastStatus?: string;
  firedAt?: number;
}

export interface TatkalWatch {
  kind: 'tatkal';
  id: string;
  train: string;
  trainName: string;
  from: string;
  to: string;
  date: string;
  cls: string;
  leadMin: number;
  firedAt?: number;
}

export interface TripWatch {
  kind: 'trip';
  id: string;
  train: string;
  trainName: string;
  // boarding station
  station: string;
  stationName: string;
  date: string;
  lastPlatform?: string | null;
  // last delay bucket alerted, in 30-minute steps
  lastDelayStep?: number;
  firedAt?: number;
}

export type Watch = SeatWatch | TatkalWatch | TripWatch;

export interface Alert {
  title: string;
  body: string;
  url: string;
}

export interface EvalResult {
  alert: Alert | null;
  next: Watch;
  done: boolean;
}

const IST_MS = 5.5 * 3600_000;
const DAY_MS = 86_400_000;
const AC = new Set(['1A', '2A', '3A', '3E', 'CC', 'EC', 'EA', 'EV', 'VC', 'VS']);

export const seatWatchId = (w: Pick<SeatWatch, 'train' | 'from' | 'to' | 'date' | 'cls' | 'quota'>) => `seat:${w.train}:${w.from}:${w.to}:${w.date}:${w.cls}:${w.quota}`;
export const tatkalWatchId = (w: Pick<TatkalWatch, 'train' | 'date' | 'cls'>) => `tatkal:${w.train}:${w.date}:${w.cls}`;
export const tripWatchId = (w: Pick<TripWatch, 'train' | 'station' | 'date'>) => `trip:${w.train}:${w.station}:${w.date}`;

// IRCTC rule: the day before the journey, 10:00 IST for AC classes and 11:00 for the rest.
export function tatkalOpensAt(date: string, cls: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const hour = AC.has(cls.toUpperCase()) ? 10 : 11;
  return Date.UTC(y, m - 1, d - 1, hour, 0) - IST_MS;
}

// End of the journey day in IST, plus a grace day.
export function watchExpired(w: Watch, now: number): boolean {
  const [y, m, d] = w.date.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 23, 59) - IST_MS + DAY_MS < now;
}

// Seats you can actually book or board on.
export function isBookable(status: string): boolean {
  return /^(AVL|RAC|CNF|AVAILABLE)/i.test(status.trim());
}

export function evalSeat(w: SeatWatch, status: string | null, prediction: string, now: number): EvalResult {
  if (watchExpired(w, now)) return { alert: null, next: w, done: true };
  if (!status) return { alert: null, next: w, done: false };
  const next = { ...w, lastStatus: status };
  const wasBookable = !!w.lastStatus && isBookable(w.lastStatus);
  if (isBookable(status) && !wasBookable) {
    return {
      alert: {
        title: `${w.cls} seats on ${w.train}`,
        body: `${w.trainName} ${w.from}→${w.to} on ${w.date}: now ${status}${prediction ? ` (${prediction})` : ''}. Book soon; it can change.`,
        url: `/trains?from=${w.from}&to=${w.to}&date=${w.date}&quota=${w.quota}`,
      },
      next: { ...next, firedAt: now },
      done: false,
    };
  }
  return { alert: null, next, done: false };
}

export function evalTatkal(w: TatkalWatch, now: number): EvalResult {
  const opens = tatkalOpensAt(w.date, w.cls);
  if (now > opens + 2 * 3600_000) return { alert: null, next: w, done: true };
  if (!w.firedAt && now >= opens - w.leadMin * 60_000) {
    const t = new Date(opens + IST_MS).toISOString().slice(11, 16);
    return {
      alert: {
        title: `Tatkal opens at ${t}`,
        body: `${w.cls} Tatkal for ${w.train} ${w.trainName} (${w.from}→${w.to}, ${w.date}) opens at ${t} IST. Log in to the booking site now.`,
        url: `/trains?from=${w.from}&to=${w.to}&date=${w.date}&quota=TQ`,
      },
      next: { ...w, firedAt: now },
      done: true,
    };
  }
  return { alert: null, next: w, done: false };
}

export function evalTrip(w: TripWatch, row: { platform: string | null; delayMin: number | null; cancelled: boolean; departed: boolean } | null, now: number): EvalResult {
  if (watchExpired(w, now)) return { alert: null, next: w, done: true };
  if (!row) return { alert: null, next: w, done: false };
  const url = `/station/${w.station}?train=${w.train}`;
  if (row.cancelled) {
    return { alert: { title: `${w.train} cancelled`, body: `${w.trainName} is shown as cancelled at ${w.stationName}. Check your ticket for a refund.`, url }, next: { ...w, firedAt: now }, done: true };
  }
  if (row.departed) return { alert: null, next: w, done: true };
  const next: TripWatch = { ...w };
  const parts: string[] = [];
  if (row.platform) {
    if (w.lastPlatform && w.lastPlatform !== row.platform) parts.push(`platform changed ${w.lastPlatform} → ${row.platform}`);
    next.lastPlatform = row.platform;
  }
  const step = row.delayMin && row.delayMin >= 30 ? Math.floor(row.delayMin / 30) : 0;
  if (step > (w.lastDelayStep ?? 0)) parts.push(`running ${row.delayMin} min late`);
  next.lastDelayStep = Math.max(step, w.lastDelayStep ?? 0);
  if (parts.length === 0) return { alert: null, next, done: false };
  return {
    alert: { title: `${w.train} at ${w.stationName}`, body: `${w.trainName}: ${parts.join('; ')}.`, url },
    next: { ...next, firedAt: now },
    done: false,
  };
}

// A train's row on a station board, preferring the run that departs on `date`.
export function pickBoardRow(rows: BoardRow[], train: string, date?: string): BoardRow | null {
  const mine = rows.filter((r) => r.trainNo === train);
  return (date ? mine.find((r) => (r.schDepIso ?? '').startsWith(date)) : null) ?? mine[0] ?? null;
}
