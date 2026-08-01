import { describe, it, expect } from 'vitest';
import { computeBoundingBox, getTerrainFeatures } from './overpass';

describe('computeBoundingBox', () => {
  it('pads the bounding box around a route', () => {
    const box = computeBoundingBox([
      [72.0, 19.0],
      [77.0, 28.0],
    ]);
    expect(box.minLng).toBeCloseTo(71.95);
    expect(box.maxLng).toBeCloseTo(77.05);
    expect(box.minLat).toBeCloseTo(18.95);
    expect(box.maxLat).toBeCloseTo(28.05);
  });
});

describe('getTerrainFeatures', () => {
  it('returns an empty array for an empty route', async () => {
    const result = await getTerrainFeatures([]);
    expect(result).toEqual([]);
  });
});
