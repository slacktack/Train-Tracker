import { describe, expect, it } from 'vitest';
import type { Combo, ComboLeg } from '@/lib/combos-types';
import { applyFilters, comboFare, DEFAULT_COMBO_FILTERS, sortCombos } from './combo-sort';

const leg = (fare: number, verdict: 'confirm' | 'no-chance' = 'confirm'): ComboLeg =>
  ({ train: { classes: [{ cls: 'SL', fare, verdict, status: '', raw: '', prediction: '', predictionPct: null, cachedAt: null }] }, depIso: '2026-10-06', depTime: '08:00', arrIso: '2026-10-06', arrTime: '12:00', durationMin: 240 }) as unknown as ComboLeg;
const combo = (id: string, total: number, layover: number, fares: [number, number], arrTime: string, risk: Combo['risk'], bookable = true): Combo =>
  ({ id, legs: [leg(fares[0]), leg(fares[1])], stops: [{ hub: { code: 'X', name: 'X' }, layoverMin: layover, risk }], layoverMin: layover, totalMin: total, risk, bookable, arrIso: '2026-10-07', arrTime }) as Combo;

const a = combo('a', 1800, 150, [500, 600], '14:00', 'ok');
const b = combo('b', 1650, 70, [900, 900], '09:00', 'tight');
const c = combo('c', 2100, 400, [200, 300], '20:00', 'long', false);

describe('combo sorting', () => {
  it('fastest orders by total time', () => expect(sortCombos([a, b, c], 'fastest', false).map((x) => x.id)).toEqual(['b', 'a', 'c']));
  it('cheapest orders by total fare', () => expect(sortCombos([a, b, c], 'cheapest', false).map((x) => x.id)).toEqual(['c', 'a', 'b']));
  it('earliest orders by arrival', () => expect(sortCombos([a, b, c], 'earliest', false).map((x) => x.id)).toEqual(['b', 'a', 'c']));
  it('safest prefers a 2 to 4 hour change', () => expect(sortCombos([a, b, c], 'safest', false)[0].id).toBe('a'));
  it('best balances time, seats and safety', () => expect(sortCombos([a, b, c], 'best', false)[0].id).toBe('a'));
  it('sums both legs for the fare', () => expect(comboFare(a, false)).toBe(1100));
  it('ignores unlikely classes when asked', () => {
    const x = { ...a, legs: [leg(500, 'no-chance'), leg(600)] } as Combo;
    expect(comboFare(x, true)).toBeNull();
  });
});

describe('combo filters', () => {
  it('hides tight changes', () => expect(applyFilters([a, b, c], { ...DEFAULT_COMBO_FILTERS, noTight: true }).map((x) => x.id)).toEqual(['a', 'c']));
  it('keeps only likely seats', () => expect(applyFilters([a, b, c], { ...DEFAULT_COMBO_FILTERS, likelySeats: true }).map((x) => x.id)).toEqual(['a', 'b']));
  it('hides waits over six hours', () => expect(applyFilters([a, b, c], { ...DEFAULT_COMBO_FILTERS, shortWait: true }).map((x) => x.id)).toEqual(['a', 'b']));
});
