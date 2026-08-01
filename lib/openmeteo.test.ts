import { describe, it, expect } from 'vitest';
import { mapWeatherCode, isRainCode } from './openmeteo';

describe('mapWeatherCode', () => {
  it('maps known WMO codes', () => {
    expect(mapWeatherCode(0)).toBe('Clear sky');
    expect(mapWeatherCode(95)).toBe('Thunderstorm');
  });

  it('returns Unknown for an unmapped code', () => {
    expect(mapWeatherCode(999)).toBe('Unknown');
  });
});

describe('isRainCode', () => {
  it('treats drizzle/rain/shower/thunderstorm codes as rain', () => {
    expect(isRainCode(61)).toBe(true);
    expect(isRainCode(82)).toBe(true);
    expect(isRainCode(95)).toBe(true);
  });

  it('treats clear/cloudy codes as not rain', () => {
    expect(isRainCode(0)).toBe(false);
    expect(isRainCode(3)).toBe(false);
  });
});
