import { describe, it, expect } from 'vitest';
import { buildElevationPath } from './ElevationChart';

describe('buildElevationPath', () => {
  it('returns an empty string for no points', () => {
    expect(buildElevationPath([], 100, 100)).toBe('');
  });

  it('starts with M and uses L for subsequent points', () => {
    const points = [
      { lat: 0, lng: 0, elevationM: 100, distanceKm: 0 },
      { lat: 0, lng: 0, elevationM: 200, distanceKm: 50 },
      { lat: 0, lng: 0, elevationM: 150, distanceKm: 100 },
    ];
    const path = buildElevationPath(points, 100, 100);
    expect(path.startsWith('M')).toBe(true);
    expect(path.split(' ').length).toBe(3);
  });

  it('places the lowest elevation point at the bottom (max y)', () => {
    const points = [
      { lat: 0, lng: 0, elevationM: 0, distanceKm: 0 },
      { lat: 0, lng: 0, elevationM: 1000, distanceKm: 100 },
    ];
    const path = buildElevationPath(points, 100, 100);
    const firstY = parseFloat(path.split(' ')[0].split(',')[1]);
    expect(firstY).toBeCloseTo(100);
  });
});
