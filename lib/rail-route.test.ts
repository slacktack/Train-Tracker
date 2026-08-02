import { describe, it, expect } from 'vitest';
import { snapPointToPolyline } from './rail-route';

describe('snapPointToPolyline', () => {
  it('snaps a point onto the nearest segment of a polyline', () => {
    const coords: [number, number][] = [
      [77.0, 12.0],
      [77.1, 12.0],
      [77.2, 12.0],
    ];
    const result = snapPointToPolyline(12.0, 77.05, coords);
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(12.0, 5);
    expect(result!.lng).toBeCloseTo(77.05, 2);
    expect(result!.distanceKm).toBeLessThan(1);
  });

  it('returns null for a polyline with fewer than 2 points', () => {
    expect(snapPointToPolyline(12.0, 77.0, [[77.0, 12.0]])).toBeNull();
  });
});
