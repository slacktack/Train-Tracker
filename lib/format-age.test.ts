import { describe, expect, it } from 'vitest';
import { formatAge, parseUpstreamTime } from './format';

const NOW = Date.parse('2026-10-11T15:15:00Z');

describe('formatAge', () => {
  it('labels recent, minute and hour ages', () => {
    expect(formatAge(NOW - 20_000, 'en', NOW)).toBe('just now');
    expect(formatAge(NOW - 4 * 60_000, 'en', NOW)).toBe('4 min ago');
    expect(formatAge(NOW - 3 * 3600_000, 'en', NOW)).toBe('3 h ago');
    expect(formatAge(NOW - 4 * 60_000, 'hi', NOW)).toBe('4 मिनट पहले');
  });
  it('is empty without a time', () => {
    expect(formatAge(null, 'en', NOW)).toBe('');
  });
});

describe('parseUpstreamTime', () => {
  it('reads zoneless ConfirmTkt stamps as IST', () => {
    expect(parseUpstreamTime('2026-10-11T20:56:03.001')).toBe(Date.parse('2026-10-11T15:26:03.001Z'));
  });
  it('respects explicit zones and rejects junk', () => {
    expect(parseUpstreamTime('2026-10-11T10:00:00Z')).toBe(Date.parse('2026-10-11T10:00:00Z'));
    expect(parseUpstreamTime('nope')).toBeNull();
    expect(parseUpstreamTime(null)).toBeNull();
  });
});
