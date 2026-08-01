import { describe, it, expect } from 'vitest';
import { searchLocalTrains, TRAINS_DB } from './trains-db';

describe('searchLocalTrains', () => {
  it('returns popular trains for an empty query', () => {
    const results = searchLocalTrains('');
    expect(results.length).toBe(12);
  });

  it('matches by train number prefix', () => {
    const results = searchLocalTrains('12951');
    expect(results.some((t) => t.number === '12951')).toBe(true);
  });

  it('matches by name substring, case-insensitive', () => {
    const results = searchLocalTrains('rajdhani');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((t) => t.name.toLowerCase().includes('rajdhani'))).toBe(true);
  });

  it('caps results at 15', () => {
    const results = searchLocalTrains('e');
    expect(results.length).toBeLessThanOrEqual(15);
  });

  it('every entry has a unique train number', () => {
    const numbers = TRAINS_DB.map((t) => t.number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});
