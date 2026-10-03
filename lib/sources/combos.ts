import { readFileSync } from 'fs';
import { join } from 'path';
import { cached } from '@/lib/api';
import type { AvailabilityResult, AvailabilityTrain, ClassAvailability, Quota } from './confirmtkt';
import { getAvailabilityBest } from './confirmtkt';
import { getStation } from './offline';
import { timetableHubs } from './timetable';
import { searchableStations } from './offline-near';
import { toMinutes } from '@/lib/combo-time';
import type { ChangeRisk, Combo, ComboLeg, ComboStop } from '@/lib/combos-types';

const MIN_LAYOVER = 60;
const MAX_LAYOVER = 24 * 60;
const TIGHT = 90;
const LONG = 5 * 60;
const MAX_HUBS = 12;
const MAX_DETOUR = 1.35;
const POOL = 5;
const RISK_PENALTY = (r: ChangeRisk, layover: number) => (r === 'tight' ? 240 : r === 'long' ? Math.round((layover - LONG) / 2) : 0);


// ─── time helpers: minutes since epoch, treating IST wall-clock as UTC ──────
export const toMin = toMinutes;
const isoOf = (min: number) => new Date(min * 60000).toISOString().slice(0, 10);
const hhmmOf = (min: number) => new Date(min * 60000).toISOString().slice(11, 16);
const addDays = (iso: string, n: number) => isoOf(toMin(iso, '00:00') + n * 1440);

function durationOf(t: AvailabilityTrain, dep: number, iso: string): number {
  const m = t.duration?.match(/^(\d+):(\d{2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return (toMin(iso, t.arrival) - dep + 1440) % 1440;
}

export function leg(t: AvailabilityTrain, iso: string): ComboLeg {
  const dep = toMin(iso, t.departure);
  const dur = durationOf(t, dep, iso);
  const arr = dep + dur;
  return { train: t, depIso: iso, depTime: t.departure, arrIso: isoOf(arr), arrTime: hhmmOf(arr), durationMin: dur };
}

const RANK = { confirm: 3, probable: 2, unknown: 1, 'no-chance': 0, closed: -1 } as const;
export const bestClass = (t: AvailabilityTrain): ClassAvailability | null =>
  [...t.classes].filter((c) => c.verdict !== 'closed').sort((a, b) => RANK[b.verdict] - RANK[a.verdict] || (a.fare ?? 1e9) - (b.fare ?? 1e9))[0] ?? null;

const bookable = (t: AvailabilityTrain) => {
  const c = bestClass(t);
  return !!c && (c.verdict === 'confirm' || c.verdict === 'probable');
};

// ─── geography + connectivity ────────────────────────────────────────────────
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = (d: number) => (d * Math.PI) / 180;
  const x = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
};

let connectivity: Record<string, string[]> | null = null;
function reach(code: string): Set<string> {
  connectivity ??= JSON.parse(readFileSync(join(process.cwd(), 'data/station-connectivity.json'), 'utf8')) as Record<string, string[]>;
  return new Set(connectivity[code] ?? []);
}

// Timetable first (so a hub like Itarsi can never be missed), then a few big junctions for specials the timetable lacks.
export function hubCandidates(from: string, to: string): string[] {
  const a = getStation(from);
  const b = getStation(to);
  if (!a || !b) return [];
  const direct = km(a, b) || 1;
  const chosen: string[] = [];
  try {
    for (const h of timetableHubs(from, to, MAX_HUBS * 2)) {
      const s = getStation(h.code);
      if (!s) continue;
      if ((km(a, s) + km(s, b)) / direct > 1.6) continue;
      chosen.push(h.code);
      if (chosen.length >= MAX_HUBS - 3) break;
    }
  } catch {
    // timetable unavailable: fall back to the popularity list below
  }
  const common = Array.from(reach(from)).filter((c) => reach(to).has(c) && c !== from && c !== to && !chosen.includes(c));
  const extras = common
    .map((code) => {
      const s = getStation(code);
      if (!s) return null;
      const via = km(a, s) + km(s, b);
      return { code, detour: via / direct, pop: s.pop, near: Math.min(km(a, s), km(s, b)) };
    })
    .filter((h): h is { code: string; detour: number; pop: number; near: number } => !!h && h.detour <= MAX_DETOUR && h.near >= 25)
    .sort((x, y) => y.pop / x.detour ** 3 - x.pop / y.detour ** 3)
    .slice(0, 3)
    .map((h) => h.code);
  return [...chosen, ...extras];
}

async function pool<T, R>(items: T[], run: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(POOL, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await run(items[k]);
      }
    }),
  );
  return out;
}

const search = (from: string, to: string, iso: string, quota: Quota): Promise<AvailabilityResult> =>
  cached(`avail2:${from}:${to}:${iso}:${quota}`, 120, () =>
    getAvailabilityBest({ from, to, date: iso.split('-').reverse().join('-'), quota }),
  ).catch(() => ({ trains: [], quotas: [], fetchedAt: null }));

/** Can the second train be caught? Returns the wait and how safe it is, or null when it must not be offered. */
export function connection(arr1: number, dep2: number): { layoverMin: number; risk: ChangeRisk } | null {
  const layoverMin = dep2 - arr1;
  if (layoverMin < MIN_LAYOVER || layoverMin > MAX_LAYOVER) return null;
  return { layoverMin, risk: layoverMin < TIGHT ? 'tight' : layoverMin > LONG ? 'long' : 'ok' };
}

export function assemble(legs: ComboLeg[], stops: ComboStop[], id: string): Combo {
  const first = legs[0];
  const last = legs[legs.length - 1];
  const dep = toMin(first.depIso, first.depTime);
  const arr = toMin(last.arrIso, last.arrTime);
  const rank: Record<ChangeRisk, number> = { ok: 0, long: 1, tight: 2 };
  return {
    id,
    legs,
    stops,
    layoverMin: stops.reduce((n, x) => n + x.layoverMin, 0),
    totalMin: arr - dep,
    risk: stops.reduce<ChangeRisk>((w, x) => (rank[x.risk] > rank[w] ? x.risk : w), 'ok'),
    bookable: legs.every((l) => bookable(l.train)),
    depIso: first.depIso,
    depTime: first.depTime,
    arrIso: last.arrIso,
    arrTime: last.arrTime,
  };
}

// ─── connecting itineraries ──────────────────────────────────────────────────
export async function findCombos(from: string, to: string, iso: string, quota: Quota): Promise<{ combos: Combo[]; searched: number }> {
  const hubs = hubCandidates(from, to);
  let searched = 0;

  const perHub = await pool(hubs, async (hub) => {
    const first = await search(from, hub, iso, quota);
    searched++;
    const legs1 = first.trains.filter((t) => !t.departed).map((t) => leg(t, iso));
    if (legs1.length === 0) return [] as Combo[];

    // the second train may leave the same day or the next, so ask for both
    const arrDates = new Set<string>();
    for (const l of legs1) {
      arrDates.add(l.arrIso);
      arrDates.add(addDays(l.arrIso, 1));
    }
    const seconds = await Promise.all(Array.from(arrDates).map(async (d) => ({ d, res: await search(hub, to, d, quota) })));
    searched += arrDates.size;

    const hubStation = getStation(hub);
    const found: Combo[] = [];
    for (const l1 of legs1) {
      const arr1 = toMin(l1.arrIso, l1.arrTime);
      for (const { d, res } of seconds) {
        for (const t2 of res.trains) {
          if (t2.number === l1.train.number) continue;
          const l2 = leg(t2, d);
          const dep2 = toMin(l2.depIso, l2.depTime);
          const link = connection(arr1, dep2);
          if (!link) continue;
          const layover = link.layoverMin;
          found.push(assemble([l1, l2], [{ hub: { code: hub, name: hubStation?.name ?? hub }, layoverMin: layover, risk: link.risk }], `${l1.train.number}-${hub}-${t2.number}-${d}`));
        }
      }
    }
    // per hub keep the few that matter: earliest arrival, then shortest wait
    return found.sort((x, y) => toMin(x.arrIso, x.arrTime) - toMin(y.arrIso, y.arrTime) || x.layoverMin - y.layoverMin).slice(0, 5);
  });

  // One number for "how good": time on the road, plus penalties for waitlists, tight changes and long waits.
  const score = (c: Combo) => c.totalMin + (c.bookable ? 0 : 300) + c.stops.reduce((n, x) => n + RISK_PENALTY(x.risk, x.layoverMin), 0);

  const seen = new Set<string>();
  const combos = perHub
    .flat()
    .sort((x, y) => score(x) - score(y) || x.layoverMin - y.layoverMin)
    .filter((c) => {
      const k = c.legs.map((l) => l.train.number).join('-');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 30);

  const pick = (list: Combo[], key: (c: Combo) => number) => list.reduce<Combo | null>((b, c) => (!b || key(c) < key(b) ? c : b), null);
  const tag = (c: Combo | null, t: 'fastest' | 'bestSeats' | 'safest') => c && (c.tags = [...(c.tags ?? []), t]);
  tag(pick(combos, (c) => c.totalMin), 'fastest');
  tag(pick(combos.filter((c) => c.bookable), (c) => c.totalMin), 'bestSeats');
  tag(pick(combos.filter((c) => c.layoverMin >= 120 && c.layoverMin <= 360), (c) => c.totalMin), 'safest');
  return { combos, searched };
}



// ─── user-chosen route: From, any number of via stations, To ─────────────────


/** Chain trains leg by leg through the stations the user listed, checking every change. */
export async function planRoute(stops: string[], iso: string, quota: Quota): Promise<{ combos: Combo[]; legCounts: number[]; searched: number; suggestions: RouteSuggestion[] }> {
  let searched = 0;
  const memo = new Map<string, Promise<AvailabilityResult>>();
  const find = (a: string, b: string, d: string) => {
    const k = `${a}>${b}@${d}`;
    if (!memo.has(k)) {
      searched++;
      memo.set(k, search(a, b, d, quota));
    }
    return memo.get(k)!;
  };

  const legCounts: number[] = [];
  const first = await find(stops[0], stops[1], iso);
  const firstLegs = first.trains.filter((t) => !t.departed).map((t) => leg(t, iso));
  legCounts.push(firstLegs.length);
  type Chain = { legs: ComboLeg[]; stops: ComboStop[] };
  let chains: Chain[] = firstLegs.map((l) => ({ legs: [l], stops: [] }));
  const BEAM = 60;
  const penalty = (c: Chain) => {
    const dep = toMin(c.legs[0].depIso, c.legs[0].depTime);
    const arr = toMin(c.legs[c.legs.length - 1].arrIso, c.legs[c.legs.length - 1].arrTime);
    return arr - dep + c.stops.reduce((n, x) => n + RISK_PENALTY(x.risk, x.layoverMin), 0);
  };

  for (let k = 1; k < stops.length - 1 && chains.length > 0; k++) {
    const hub = stops[k];
    const hubName = getStation(hub)?.name ?? hub;
    const dates = new Set<string>();
    for (const c of chains) {
      const last = c.legs[c.legs.length - 1];
      dates.add(last.arrIso);
      dates.add(addDays(last.arrIso, 1));
    }
    const lists = await Promise.all(Array.from(dates).map(async (d) => ({ d, res: await find(hub, stops[k + 1], d) })));
    legCounts.push(lists.reduce((n, x) => Math.max(n, x.res.trains.length), 0));

    const next: Chain[] = [];
    for (const c of chains) {
      const prev = c.legs[c.legs.length - 1];
      const arrPrev = toMin(prev.arrIso, prev.arrTime);
      for (const { d, res } of lists) {
        for (const t of res.trains) {
          const nl = leg(t, d);
          const dep = toMin(nl.depIso, nl.depTime);
          // staying on the same train with a separately booked ticket is allowed: nothing to catch
          const same = t.number === prev.train.number && dep >= arrPrev && dep - arrPrev <= 90;
          const link = same ? { layoverMin: Math.max(0, dep - arrPrev), risk: 'ok' as ChangeRisk } : connection(arrPrev, dep);
          if (!link) continue;
          next.push({ legs: [...c.legs, nl], stops: [...c.stops, { hub: { code: hub, name: hubName }, layoverMin: link.layoverMin, risk: link.risk, sameTrain: same || undefined }] });
        }
      }
    }
    chains = next.sort((a, b) => penalty(a) - penalty(b)).slice(0, BEAM);
  }

  const suggestions = chains.length === 0 ? await suggestFixes(stops, legCounts, iso, find) : [];

  const combos = chains
    .map((c) => assemble(c.legs, c.stops, c.legs.map((l) => `${l.train.number}@${l.depIso}`).join('>')))
    .sort((x, y) => x.totalMin + (x.bookable ? 0 : 300) - (y.totalMin + (y.bookable ? 0 : 300)))
    .slice(0, 30);
  return { combos, legCounts, searched, suggestions };
}


export interface RouteSuggestion {
  /** which stop in the list could be swapped */
  stopIndex: number;
  code: string;
  name: string;
  trains: number;
}

// A stop with no train to or from it is often the wrong sibling station (a suburban terminal next to the main one).
async function suggestFixes(
  stops: string[],
  legCounts: number[],
  iso: string,
  find: (a: string, b: string, d: string) => Promise<AvailabilityResult>,
): Promise<RouteSuggestion[]> {
  const broken = legCounts.findIndex((n) => n === 0);
  const k = broken >= 0 ? broken : 0;
  const target = stops[k + 1];
  const t = getStation(target);
  if (!t) return [];
  const near = searchableStations()
    .filter((x) => x.code !== target && x.pop >= 150 && km(t, x) <= 30)
    .sort((a, b) => b.pop - a.pop)
    .slice(0, 5);
  const out: RouteSuggestion[] = [];
  for (const c of near) {
    const res = await find(stops[k], c.code, iso);
    const n = res.trains.filter((x) => !x.departed).length;
    if (n > 0) out.push({ stopIndex: k + 1, code: c.code, name: c.name, trains: n });
  }
  return out.sort((a, b) => b.trains - a.trains).slice(0, 3);
}
