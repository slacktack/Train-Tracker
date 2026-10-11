import { describe, expect, it } from 'vitest';
import { upcomingTrips } from './MyTrips';
import { isPnrExpired, maskPnr } from '@/store/useRecentsExtras';

const NOW = Date.parse('2026-10-11T12:00:00+05:30');

describe('trips from remembered PNRs', () => {
  it('masks all but the last four digits', () => {
    expect(maskPnr('1234567890')).toBe('••••••7890');
  });
  it('expires a day after the journey, or after 30 days undated', () => {
    expect(isPnrExpired({ pnr: '1', doj: '2026-10-10' }, NOW)).toBe(false);
    expect(isPnrExpired({ pnr: '1', doj: '2026-10-09' }, NOW)).toBe(true);
    expect(isPnrExpired({ pnr: '1', savedAt: NOW - 31 * 86_400_000 }, NOW)).toBe(true);
  });
  it('keeps dated train trips, soonest first', () => {
    const trips = upcomingTrips(
      [
        { pnr: 'a', trainNo: '12951', doj: '2026-10-20' },
        { pnr: 'b', trainNo: '12301', doj: '2026-10-12' },
        { pnr: 'c', trainName: 'no train no' },
        { pnr: 'd', trainNo: '1', doj: '2026-09-01' },
      ],
      NOW,
    );
    expect(trips.map((x) => x.pnr)).toEqual(['b', 'a']);
  });
});
