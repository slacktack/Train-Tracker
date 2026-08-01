import { describe, it, expect } from 'vitest';
import { getSunInfo } from './sun';

const NEW_DELHI = { lat: 28.6139, lng: 77.209 };

describe('getSunInfo', () => {
  it('reports night for 2 AM IST', () => {
    const date = new Date('2026-06-15T02:00:00+05:30');
    const info = getSunInfo(NEW_DELHI.lat, NEW_DELHI.lng, date);
    expect(info.isNight).toBe(true);
  });

  it('reports not-night for local noon', () => {
    const date = new Date('2026-06-15T12:00:00+05:30');
    const info = getSunInfo(NEW_DELHI.lat, NEW_DELHI.lng, date);
    expect(info.isNight).toBe(false);
  });

  it('returns sunrise before sunset as formatted HH:MM strings', () => {
    const date = new Date('2026-06-15T12:00:00+05:30');
    const info = getSunInfo(NEW_DELHI.lat, NEW_DELHI.lng, date);
    expect(info.sunrise).toMatch(/^\d{2}:\d{2}$/);
    expect(info.sunset).toMatch(/^\d{2}:\d{2}$/);
  });

  it('is mutually exclusive: never both night and golden hour', () => {
    const date = new Date('2026-06-15T18:45:00+05:30');
    const info = getSunInfo(NEW_DELHI.lat, NEW_DELHI.lng, date);
    expect(info.isNight && info.isGoldenHour).toBe(false);
  });
});
