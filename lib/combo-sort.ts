import type { Combo, ComboLeg } from '@/lib/combos-types';
import { toMinutes } from '@/lib/combo-time';

export type ComboSort = 'best' | 'fastest' | 'cheapest' | 'earliest' | 'safest';

export interface ComboFilters {
  /** only itineraries where both trains have confirmed or likely seats */
  likelySeats: boolean;
  /** hide changes under 90 minutes */
  noTight: boolean;
  /** hide waits over 6 hours */
  shortWait: boolean;
}

export const DEFAULT_COMBO_FILTERS: ComboFilters = { likelySeats: false, noTight: false, shortWait: false };

const okSeat = (c: { verdict: string }) => c.verdict === 'confirm' || c.verdict === 'probable';

/** Cheapest fare for one leg; with `likelyOnly`, only classes that can realistically be booked. */
export function legFare(leg: ComboLeg, likelyOnly: boolean): number | null {
  const fares = leg.train.classes
    .filter((c) => c.verdict !== 'closed' && c.fare && (!likelyOnly || okSeat(c)))
    .map((c) => c.fare as number);
  return fares.length ? Math.min(...fares) : null;
}

export function comboFare(c: Combo, likelyOnly: boolean): number | null {
  let sum = 0;
  for (const l of c.legs) {
    const f = legFare(l, likelyOnly);
    if (f === null) return null;
    sum += f;
  }
  return sum;
}

const longestWait = (c: Combo) => c.stops.reduce((m, x) => Math.max(m, x.layoverMin), 0);

const arrival = (c: Combo) => toMinutes(c.arrIso, c.arrTime);
// How far the change is from a comfortable 2 to 4 hours
// How far each change is from a comfortable 2 to 4 hours (a same-train split has nothing to catch)
const comfort = (c: Combo) => c.stops.reduce((n, x) => n + (x.sameTrain ? 0 : x.layoverMin < 120 ? 120 - x.layoverMin : x.layoverMin > 240 ? x.layoverMin - 240 : 0), 0);

export function applyFilters(list: Combo[], f: ComboFilters): Combo[] {
  return list.filter((c) => (!f.likelySeats || c.bookable) && (!f.noTight || c.risk !== 'tight') && (!f.shortWait || longestWait(c) <= 360));
}

export function sortCombos(list: Combo[], by: ComboSort, likelyOnly: boolean): Combo[] {
  const copy = [...list];
  const tie = (a: Combo, b: Combo) => a.totalMin - b.totalMin || a.layoverMin - b.layoverMin;
  switch (by) {
    case 'fastest':
      return copy.sort(tie);
    case 'earliest':
      return copy.sort((a, b) => arrival(a) - arrival(b) || tie(a, b));
    case 'cheapest':
      return copy.sort((a, b) => (comboFare(a, likelyOnly) ?? Infinity) - (comboFare(b, likelyOnly) ?? Infinity) || tie(a, b));
    case 'safest':
      return copy.sort((a, b) => comfort(a) - comfort(b) || tie(a, b));
    default: {
      const score = (c: Combo) => c.totalMin + (c.bookable ? 0 : 300) + (c.risk === 'tight' ? 240 : 0) + c.stops.reduce((n, x) => n + (x.risk === 'long' ? Math.round((x.layoverMin - 300) / 2) : 0), 0);
      return copy.sort((a, b) => score(a) - score(b) || a.layoverMin - b.layoverMin);
    }
  }
}
