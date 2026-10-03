import { describe, expect, it } from 'vitest';
import type { LiveJourney, Station } from '@/types/train';
import { humanMinutes, whereNow } from './where-now';
import { buildRows } from '@/components/Journey/RouteDiagram';
import { locateOnRoute } from '@/components/Journey/LocateMe';

const st = (code: string, status: Station['status'], lat: number, lng: number): Station => ({
  code, name: code, lat, lng, scheduledArrival: '10:00', scheduledDeparture: '10:05', delayMinutes: 0, distanceKm: 0, status,
});
const journey = (stations: Station[], status: LiveJourney['status'] = 'running'): LiveJourney =>
  ({
    trainId: '1', number: '1', name: 'T', origin: { code: 'A', name: 'A' }, destination: { code: 'E', name: 'E' },
    currentLocation: { lat: 12.5, lng: 77.5, heading: 0, speedKmh: 50, isMoving: true }, status, delayMinutes: 0, speedKmh: 50,
    distanceCoveredKm: 0, remainingDistanceKm: 0, totalDistanceKm: 0, completionPercentage: 40, lastUpdated: '', ETA: '', stations,
    previousStation: stations.find((s) => s.status === 'passed'), nextStation: stations.find((s) => s.status === 'upcoming'),
  }) as LiveJourney;

const five = [st('A', 'passed', 12, 77), st('B', 'passed', 12.3, 77.3), st('C', 'upcoming', 13, 78), st('D', 'upcoming', 14, 79), st('E', 'upcoming', 15, 80)];

describe('where is the train now', () => {
  it('says it is between the last passed and next stop', () => {
    const w = whereNow(journey(five));
    expect(w.kind).toBe('between');
    if (w.kind === 'between') expect(w.next.code).toBe('C');
  });
  it('reports not started and completed', () => {
    expect(whereNow(journey(five, 'not_started')).kind).toBe('notStarted');
    expect(whereNow(journey(five, 'completed')).kind).toBe('completed');
  });
  it('formats minutes for people', () => {
    expect(humanMinutes(84, 'en')).toBe('1 h 24 min');
    expect(humanMinutes(7, 'en')).toBe('7 min');
  });
});

describe('route diagram', () => {
  it('always ends at the real destination', () => {
    const rows = buildRows(journey(five), false, false);
    const last = rows[rows.length - 1];
    expect(last.type === 'stop' && last.station.code).toBe('E');
    expect(rows[0].type === 'stop' && rows[0].station.code).toBe('A');
  });
  it('folds the stops in between', () => {
    expect(buildRows(journey(five), false, false).some((r) => r.type === 'fold')).toBe(true);
  });
});

describe('GPS on the route', () => {
  it('places a point between two stations', () => {
    const r = locateOnRoute(five, { lat: 12.65, lng: 77.15, acc: 20 });
    expect(r?.prev.code).toBe('B');
    expect(r?.next.code).toBe('C');
  });
});
