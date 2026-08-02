import { describe, it, expect } from 'vitest';
import { interpolatePolyline, generateFallbackJourney, todayInIST } from './railjournal';

describe('interpolatePolyline', () => {
  const line: [number, number][] = [
    [72.8193, 18.9696],
    [75.8648, 25.2138],
    [77.2194, 28.643],
  ];

  it('returns the first point at 0%', () => {
    expect(interpolatePolyline(line, 0)).toEqual([72.8193, 18.9696]);
  });

  it('returns the last point at 100%', () => {
    expect(interpolatePolyline(line, 100)).toEqual([77.2194, 28.643]);
  });

  it('returns a point between segment endpoints at 50%', () => {
    const [lng, lat] = interpolatePolyline(line, 50);
    expect(lng).toBeGreaterThan(72.8193);
    expect(lng).toBeLessThan(77.2194);
    expect(lat).toBeGreaterThan(18.9696);
    expect(lat).toBeLessThan(28.643);
  });

  it('returns a fallback point for an empty array', () => {
    expect(interpolatePolyline([], 50)).toEqual([77.2194, 28.643]);
  });

  it('returns the single point for a single-coordinate array', () => {
    expect(interpolatePolyline([[10, 20]], 50)).toEqual([10, 20]);
  });
});

describe('todayInIST', () => {
  it('returns a DD-Mmm-YYYY date string (the format check_train_info expects)', () => {
    const date = todayInIST();
    expect(date).toMatch(/^\d{2}-[A-Z][a-z]{2}-\d{4}$/);
  });
});

describe('generateFallbackJourney', () => {
  it('returns a journey for a known train', () => {
    const journey = generateFallbackJourney('12951');
    expect(journey).not.toBeNull();
    expect(journey!.number).toBe('12951');
    expect(journey!.stations.length).toBeGreaterThanOrEqual(4);
    expect(journey!.routeGeometry).toBeDefined();
  });

  it('returns a journey for an unknown number (synthetic train)', () => {
    const journey = generateFallbackJourney('99999');
    expect(journey).not.toBeNull();
    expect(journey!.number).toBe('99999');
  });

  it('keeps status/currentStation consistent', () => {
    const journey = generateFallbackJourney('12951')!;
    expect(journey.status).toBe('running');
    expect(journey.currentStation?.code).toBe('KOTA');
    expect(journey.nextStation?.code).toBe('NDLS');
  });
});
