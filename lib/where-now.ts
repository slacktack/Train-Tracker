import type { LiveJourney, Station } from '@/types/train';
import { hhmmToMin } from '@/lib/format';

export type WhereNow =
  | { kind: 'cancelled' }
  | { kind: 'completed'; station: Station }
  | { kind: 'notStarted'; station: Station; time: string }
  | { kind: 'at'; station: Station; next?: Station; etaMin: number | null }
  | { kind: 'between'; prev?: Station; next: Station; km: number | null; etaMin: number | null; time: string };

const R = 6371;
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function istNowMin(): number {
  const d = new Date(Date.now() + 5.5 * 3600_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

// Minutes until a clock time (HH:mm), allowing for a little slack in the past.
export function minutesUntil(hhmm: string | undefined | null): number | null {
  if (!hhmm || hhmm === '--:--') return null;
  const m = hhmmToMin(hhmm);
  if (m === Number.MAX_SAFE_INTEGER) return null;
  return ((m - istNowMin() + 1440 + 120) % 1440) - 120;
}

export function expectedArrival(s: Station): string {
  return s.actualArrival ?? s.scheduledArrival;
}

export function whereNow(j: LiveJourney): WhereNow {
  const first = j.stations[0];
  const last = j.stations[j.stations.length - 1];
  if (j.status === 'cancelled') return { kind: 'cancelled' };
  if (j.status === 'completed' && last) return { kind: 'completed', station: last };
  if (j.status === 'not_started' && first) return { kind: 'notStarted', station: first, time: first.scheduledDeparture };

  const next = j.nextStation;
  const eta = next ? expectedArrival(next) : undefined;
  if (j.currentStation && j.currentStation.status === 'current') {
    return { kind: 'at', station: j.currentStation, next, etaMin: next ? minutesUntil(expectedArrival(next)) : null };
  }
  if (next) {
    const loc = j.currentLocation;
    const km = loc && next.lat && next.lng && (loc.lat || loc.lng) ? Math.round(haversineKm(loc.lat, loc.lng, next.lat, next.lng)) : null;
    return { kind: 'between', prev: j.previousStation, next, km, etaMin: minutesUntil(eta), time: eta ?? '' };
  }
  return { kind: 'completed', station: last ?? (first as Station) };
}

/** 84 -> "1 h 24 min", 7 -> "7 min" (Hindi: "1 घं 24 मि"). */
export function humanMinutes(min: number, lang: 'en' | 'hi'): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  const [hs, ms] = lang === 'hi' ? ['घं', 'मि'] : ['h', 'min'];
  return h ? `${h} ${hs}${r ? ` ${r} ${ms}` : ''}` : `${r} ${ms}`;
}
