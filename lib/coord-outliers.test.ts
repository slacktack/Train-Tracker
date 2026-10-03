import { describe, expect, it } from 'vitest';
import { dropCoordOutliers } from './railjournal';

const st = (lat: number, lng: number) => ({ lat, lng });

describe('station coordinate outliers', () => {
  it('drops a stop that juts far off the line between its neighbours', () => {
    const line = [st(21.2, 81.6), st(21.3, 82.0), st(18.5, 82.3), st(21.4, 82.4), st(21.5, 82.8)];
    const out = dropCoordOutliers(line);
    expect(out[2]).toEqual({ lat: 0, lng: 0 });
    expect(out[1].lat).toBe(21.3);
  });
  it('keeps an honest bend in the line', () => {
    const line = [st(21, 80), st(21.4, 80.6), st(21.9, 81.0), st(22.2, 81.7)];
    expect(dropCoordOutliers(line).every((s) => s.lat !== 0)).toBe(true);
  });
});
