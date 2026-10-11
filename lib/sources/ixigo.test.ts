import { describe, expect, it } from 'vitest';
import { parseStationInfo } from './ixigo';

describe('ixigo station info', () => {
  it('keeps the facility fields and drops junk', () => {
    expect(parseStationInfo({ data: { platformCount: 25, freeWifi: true, averageRating: '3.2', nearestAirport: 'DEL' } })).toEqual({ platformCount: 25, freeWifi: true, rating: 3.2, nearestAirport: 'DEL' });
    expect(parseStationInfo({ data: { platformCount: 0, averageRating: 'x' } })).toEqual({ platformCount: null, freeWifi: null, rating: null, nearestAirport: null });
    expect(parseStationInfo({ data: null })).toBeNull();
  });
});
