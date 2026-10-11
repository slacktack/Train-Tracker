import { cached, isoToDmy } from '@/lib/api';
import { getAvailabilityBest, type AvailabilityResult, type Quota } from '@/lib/sources/confirmtkt';
import { getWimtBoard } from '@/lib/sources/wimt';
import { evalSeat, evalTatkal, evalTrip, pickBoardRow, watchExpired, type EvalResult, type Watch } from '@/lib/watch';

// Shares the search route's cache key, so a cron run rarely adds upstream calls.
async function seatStatus(w: Extract<Watch, { kind: 'seat' }>) {
  const res = await cached<AvailabilityResult>(`avail3:${w.from}:${w.to}:${w.date}:${w.quota}`, 120, () =>
    getAvailabilityBest({ from: w.from, to: w.to, date: isoToDmy(w.date), quota: w.quota as Quota }),
  );
  const train = res.trains.find((t) => t.number === w.train);
  const c = train?.classes.find((x) => x.cls === w.cls);
  return c ? { status: c.status, prediction: c.prediction } : null;
}

async function tripRow(w: Extract<Watch, { kind: 'trip' }>) {
  const board = await cached(`board:${w.station}:8`, 45, () => getWimtBoard(w.station, 8));
  const r = pickBoardRow(board.rows, w.train, w.date);
  if (!r) return null;
  return {
    platform: r.platform,
    delayMin: r.delayDepMin ?? r.delayArrMin,
    cancelled: r.cancelled,
    departed: !!r.actDep && !r.atStation && !r.isTerminus,
  };
}

export async function checkWatch(w: Watch, now = Date.now()): Promise<EvalResult> {
  if (w.kind !== 'tatkal' && watchExpired(w, now)) return { alert: null, next: w, done: true };
  if (w.kind === 'tatkal') return evalTatkal(w, now);
  if (w.kind === 'seat') {
    const s = await seatStatus(w);
    return evalSeat(w, s?.status ?? null, s?.prediction ?? '', now);
  }
  return evalTrip(w, await tripRow(w), now);
}
