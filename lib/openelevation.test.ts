import { describe, it, expect } from 'vitest';
import { sampleRouteCoordinates } from './openelevation';

describe('sampleRouteCoordinates', () => {
  it('returns the input unchanged when already under maxPoints', () => {
    const coords: [number, number][] = [[0, 0], [1, 1], [2, 2]];
    expect(sampleRouteCoordinates(coords, 40)).toEqual(coords);
  });

  it('downsamples long routes to at most maxPoints', () => {
    const coords: [number, number][] = Array.from({ length: 500 }, (_, i) => [i, i]);
    const sampled = sampleRouteCoordinates(coords, 40);
    expect(sampled.length).toBeLessThanOrEqual(40);
    expect(sampled.length).toBeGreaterThan(0);
  });

  it('returns an empty array for an empty route', () => {
    expect(sampleRouteCoordinates([], 40)).toEqual([]);
  });

  it('always includes the first coordinate', () => {
    const coords: [number, number][] = Array.from({ length: 200 }, (_, i) => [i, i]);
    const sampled = sampleRouteCoordinates(coords, 40);
    expect(sampled[0]).toEqual(coords[0]);
  });
});
