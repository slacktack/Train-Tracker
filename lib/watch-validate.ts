import type { Watch } from '@/lib/watch';

const CODE = /^[A-Z0-9]{1,6}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TRAIN = /^\d{5}$/;
const CLS = /^[0-9A-Z]{2}$/;
const MAX = 20;

const str = (v: unknown, max = 80) => (typeof v === 'string' ? v.slice(0, max) : '');

// Whitelists fields so stored watches can't carry anything else.
export function cleanWatches(input: unknown): Watch[] | null {
  if (!Array.isArray(input) || input.length > MAX) return null;
  const out: Watch[] = [];
  for (const raw of input as Array<Record<string, unknown>>) {
    const train = str(raw?.train, 5);
    const date = str(raw?.date, 10);
    if (!TRAIN.test(train) || !DATE.test(date)) return null;
    const common = { train, date, trainName: str(raw.trainName), firedAt: typeof raw.firedAt === 'number' ? raw.firedAt : undefined };
    if (raw.kind === 'seat' || raw.kind === 'tatkal') {
      const from = str(raw.from, 6).toUpperCase();
      const to = str(raw.to, 6).toUpperCase();
      const cls = str(raw.cls, 2).toUpperCase();
      if (!CODE.test(from) || !CODE.test(to) || !CLS.test(cls)) return null;
      if (raw.kind === 'seat') {
        const quota = str(raw.quota, 2).toUpperCase() || 'GN';
        out.push({ ...common, kind: 'seat', id: `seat:${train}:${from}:${to}:${date}:${cls}:${quota}`, from, to, cls, quota, lastStatus: str(raw.lastStatus, 30) || undefined });
      } else {
        const leadMin = Math.min(60, Math.max(0, Number(raw.leadMin) || 10));
        out.push({ ...common, kind: 'tatkal', id: `tatkal:${train}:${date}:${cls}`, from, to, cls, leadMin });
      }
    } else if (raw.kind === 'trip') {
      const station = str(raw.station, 6).toUpperCase();
      if (!CODE.test(station)) return null;
      out.push({ ...common, kind: 'trip', id: `trip:${train}:${station}:${date}`, station, stationName: str(raw.stationName), lastPlatform: str(raw.lastPlatform, 4) || undefined, lastDelayStep: Number(raw.lastDelayStep) || 0 });
    } else return null;
  }
  return out;
}
