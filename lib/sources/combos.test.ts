import { describe, expect, it } from 'vitest';
import type { AvailabilityTrain } from './confirmtkt';
import { connection, leg, toMin } from './combos';

const train = (dep: string, arr: string, duration: string): AvailabilityTrain => ({
  number: '12345', name: 'T', from: { code: 'A', name: 'A' }, to: { code: 'B', name: 'B' }, departure: dep, arrival: arr, duration,
  distanceKm: 100, runsOn: [], hasPantry: false, departed: false, classes: [],
});

describe('leg timing', () => {
  it('uses the real duration, so a 29 hour train arrives two days later', () => {
    const l = leg(train('00:10', '05:30', '29:20'), '2026-10-06');
    expect(l.arrIso).toBe('2026-10-07');
    expect(l.arrTime).toBe('05:30');
  });
  it('rolls an overnight train over midnight', () => {
    const l = leg(train('22:40', '04:05', '05:25'), '2026-10-06');
    expect(l.arrIso).toBe('2026-10-07');
    expect(l.arrTime).toBe('04:05');
  });
});

describe('connections never strand the traveller', () => {
  const arr = toMin('2026-10-06', '12:00');
  it('rejects a second train that leaves before the first arrives', () => {
    expect(connection(arr, toMin('2026-10-06', '11:30'))).toBeNull();
  });
  it('rejects a change with under an hour to spare', () => {
    expect(connection(arr, toMin('2026-10-06', '12:45'))).toBeNull();
  });
  it('flags 60 to 89 minutes as tight', () => {
    expect(connection(arr, toMin('2026-10-06', '13:15'))?.risk).toBe('tight');
  });
  it('accepts a comfortable change', () => {
    expect(connection(arr, toMin('2026-10-06', '14:30'))).toEqual({ layoverMin: 150, risk: 'ok' });
  });
  it('treats the next morning as a valid but long wait', () => {
    expect(connection(arr, toMin('2026-10-06', '21:00'))?.risk).toBe('long');
  });
  it('keeps an overnight wait but marks it long', () => {
    expect(connection(arr, toMin('2026-10-07', '06:00'))?.risk).toBe('long');
  });
  it('drops waits longer than a day', () => {
    expect(connection(arr, toMin('2026-10-07', '13:00'))).toBeNull();
  });
});
