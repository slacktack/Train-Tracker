import { describe, expect, it } from 'vitest';
import { evalSeat, evalTatkal, evalTrip, tatkalOpensAt, type SeatWatch, type TatkalWatch, type TripWatch } from './watch';

const base = { train: '12952', trainName: 'Rajdhani', from: 'NDLS', to: 'MMCT', date: '2026-10-25' };

describe('tatkal', () => {
  it('opens the day before at 10:00 IST for AC and 11:00 otherwise', () => {
    expect(tatkalOpensAt('2026-10-25', '3A')).toBe(Date.parse('2026-10-24T10:00:00+05:30'));
    expect(tatkalOpensAt('2026-10-25', 'SL')).toBe(Date.parse('2026-10-24T11:00:00+05:30'));
  });
  it('fires once, lead minutes before opening', () => {
    const w: TatkalWatch = { ...base, kind: 'tatkal', id: 't', cls: '3A', leadMin: 10 };
    expect(evalTatkal(w, Date.parse('2026-10-24T09:45:00+05:30')).alert).toBeNull();
    const r = evalTatkal(w, Date.parse('2026-10-24T09:51:00+05:30'));
    expect(r.alert?.title).toBe('Tatkal opens at 10:00');
    expect(r.done).toBe(true);
  });
});

describe('seat watch', () => {
  const w: SeatWatch = { ...base, kind: 'seat', id: 's', cls: '3A', quota: 'GN' };
  const now = Date.parse('2026-10-20T12:00:00+05:30');
  it('alerts when a waitlist becomes bookable, not again while it stays bookable', () => {
    const a = evalSeat({ ...w, lastStatus: 'WL 12' }, 'AVL 3', '', now);
    expect(a.alert?.body).toContain('now AVL 3');
    expect(evalSeat(a.next as SeatWatch, 'AVL 2', '', now).alert).toBeNull();
  });
  it('stays quiet on waitlist and ends after the journey', () => {
    expect(evalSeat(w, 'WL 8', '90% Chance', now).alert).toBeNull();
    expect(evalSeat(w, 'AVL 3', '', Date.parse('2026-10-27T12:00:00+05:30')).done).toBe(true);
  });
});

describe('trip watch', () => {
  const w: TripWatch = { ...base, kind: 'trip', id: 'r', station: 'NDLS', stationName: 'New Delhi' };
  const now = Date.parse('2026-10-25T10:00:00+05:30');
  const row = { platform: '3', delayMin: 5, cancelled: false, departed: false };
  it('learns the platform silently, then alerts on a change', () => {
    const first = evalTrip(w, row, now);
    expect(first.alert).toBeNull();
    const changed = evalTrip(first.next as TripWatch, { ...row, platform: '7' }, now);
    expect(changed.alert?.body).toContain('platform changed 3 → 7');
  });
  it('alerts each new 30-minute delay step and on cancellation', () => {
    const late = evalTrip(w, { ...row, delayMin: 45 }, now);
    expect(late.alert?.body).toContain('45 min late');
    expect(evalTrip(late.next as TripWatch, { ...row, delayMin: 50 }, now).alert).toBeNull();
    expect(evalTrip(late.next as TripWatch, { ...row, delayMin: 65 }, now).alert).not.toBeNull();
    expect(evalTrip(w, { ...row, cancelled: true }, now).done).toBe(true);
  });
});
