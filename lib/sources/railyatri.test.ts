import { describe, expect, it } from 'vitest';
import { parsePunctuality } from './railyatri';

describe('RailYatri punctuality', () => {
  it('keeps valid 0-10 scores by train number', () => {
    const out = parsePunctuality({
      success: true,
      train_between_stations: [
        { train_number: '12952', on_time_rating: 9, from_on_time_rating: 10, to_on_time_rating: 9 },
        { train_number: '12138', on_time_rating: null },
        { train_number: '11111', on_time_rating: 42 },
        { on_time_rating: 5 },
      ],
    });
    expect(out).toEqual({ '12952': { overall: 9, from: 10, to: 9 } });
  });
});
