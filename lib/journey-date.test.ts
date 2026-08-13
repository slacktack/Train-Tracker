import { describe, it, expect } from 'vitest';
import { istDateOffset, todayInIST, isValidJourneyDate } from './railjournal';

describe('istDateOffset', () => {
  it('returns DD-Mmm-YYYY in the format check_train_info expects', () => {
    expect(istDateOffset(1)).toMatch(/^\d{2}-[A-Z][a-z]{2}-\d{4}$/);
  });

  it('today (0) matches todayInIST()', () => {
    expect(istDateOffset(0)).toBe(todayInIST());
  });

  it('walks backwards one day at a time', () => {
    const today = new Date();
    const parse = (s: string) => {
      const [d, m, y] = s.split('-');
      return Date.UTC(Number(y), ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(m), Number(d));
    };
    expect(parse(istDateOffset(2)) - parse(istDateOffset(1))).toBe(-86_400_000);
    expect(parse(istDateOffset(1)) - parse(istDateOffset(0))).toBe(-86_400_000);
    expect(today.getTime() - parse(istDateOffset(0))).toBeLessThan(86_400_000 * 2);
  });
});

describe('isValidJourneyDate', () => {
  it('accepts DD-Mmm-YYYY', () => {
    expect(isValidJourneyDate('02-Aug-2026')).toBe(true);
  });

  it('rejects malformed values', () => {
    expect(isValidJourneyDate(undefined)).toBe(false);
    expect(isValidJourneyDate('2026-08-02')).toBe(false);
    expect(isValidJourneyDate('02-08-2026')).toBe(false);
    expect(isValidJourneyDate('02-Aug-26')).toBe(false);
    expect(isValidJourneyDate('')).toBe(false);
  });
});
