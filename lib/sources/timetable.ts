import { readFileSync } from 'fs';
import { join } from 'path';

// Offline Indian Railways timetable (APK snapshot). Used only to discover which stations can
// join two trains; live times and seats always come from the booking API.
//
// Stop tuple = [stationId, minutes since the previous stop's ARRIVAL, halt minutes, distance].
// Verified against live data: 12951 reaches NDLS 08:32, 15945 leaves Itarsi 19:30.

interface RawTrain {
  r: number;
  o: number;
  s: Array<[number, number, number, number]>;
}

interface Stop {
  code: string;
  arr: number;
  dep: number;
}

interface Train {
  no: string;
  /** bit 0 = Monday ... bit 6 = Sunday */
  mask: number;
  stops: Stop[];
}

let trains: Train[] | null = null;
let byStation: Map<string, Array<{ t: number; i: number }>> | null = null;

function load() {
  if (trains) return;
  const dir = join(process.cwd(), 'data');
  const raw = JSON.parse(readFileSync(join(dir, 'train-schedules.json'), 'utf8')) as Record<string, RawTrain>;
  const ids = JSON.parse(readFileSync(join(dir, 'station-id-to-code.json'), 'utf8')) as Record<string, string>;
  trains = [];
  byStation = new Map();
  for (const [no, t] of Object.entries(raw)) {
    const stops: Stop[] = [];
    let prevArr = t.o;
    t.s.forEach(([id, move, halt], i) => {
      const arr = i === 0 ? t.o : prevArr + move;
      const dep = i === 0 ? t.o : arr + halt;
      prevArr = arr;
      const code = ids[String(id)];
      if (code) stops.push({ code, arr, dep });
    });
    const idx = trains.length;
    trains.push({ no, mask: t.r, stops });
    stops.forEach((s, i) => {
      const list = byStation!.get(s.code) ?? [];
      list.push({ t: idx, i });
      byStation!.set(s.code, list);
    });
  }
}

export interface HubOption {
  code: string;
  /** shortest scheduled ride, in minutes, on each leg */
  ride1: number;
  ride2: number;
  /** how many scheduled trains serve each leg */
  freq1: number;
  freq2: number;
}

/** Stations where one train from `from` can hand over to one train to `to`, best first. */
export function timetableHubs(from: string, to: string, limit: number): HubOption[] {
  load();
  const a = byStation!.get(from) ?? [];
  const b = byStation!.get(to) ?? [];
  const first = new Map<string, { ride: number; n: number }>();
  for (const { t, i } of a) {
    const st = trains![t].stops;
    for (let k = i + 1; k < st.length; k++) {
      const ride = st[k].arr - st[i].dep;
      const cur = first.get(st[k].code);
      first.set(st[k].code, { ride: Math.min(cur?.ride ?? Infinity, ride), n: (cur?.n ?? 0) + 1 });
    }
  }
  const second = new Map<string, { ride: number; n: number }>();
  for (const { t, i } of b) {
    const st = trains![t].stops;
    for (let k = 0; k < i; k++) {
      const ride = st[i].arr - st[k].dep;
      const cur = second.get(st[k].code);
      second.set(st[k].code, { ride: Math.min(cur?.ride ?? Infinity, ride), n: (cur?.n ?? 0) + 1 });
    }
  }
  const out: HubOption[] = [];
  first.forEach((f, code) => {
    const s = second.get(code);
    if (!s || code === from || code === to) return;
    out.push({ code, ride1: f.ride, ride2: s.ride, freq1: f.n, freq2: s.n });
  });
  // shortest total ride wins; trains that run often are worth more than a once-a-week one
  const rank = (h: HubOption) => h.ride1 + h.ride2 - 25 * Math.min(6, Math.min(h.freq1, h.freq2));
  return out.sort((x, y) => rank(x) - rank(y)).slice(0, limit);
}
