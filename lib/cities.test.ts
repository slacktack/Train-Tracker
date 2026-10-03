import { describe, expect, it } from 'vitest';
import { anchorOf, cityMembers, cityToken, isCity, titleCase, type CityStation } from './cities';

const s = (code: string, lat: number, lng: number, pop: number): CityStation => ({ code, name: code, lat, lng, pop });
const all = [s('MAS', 13.08, 80.27, 1050), s('MS', 13.07, 80.26, 503), s('TBM', 12.92, 80.12, 300), s('MASS', 13.08, 80.28, 20), s('SBC', 12.97, 77.57, 641)];

describe('city groups', () => {
  it('collects busy stations around the anchor, busiest first', () => {
    expect(cityMembers(all, 'MAS').map((x) => x.code)).toEqual(['MAS', 'MS', 'TBM']);
  });
  it('leaves out minor stations and far-away ones', () => {
    const codes = cityMembers(all, 'MAS').map((x) => x.code);
    expect(codes).not.toContain('MASS');
    expect(codes).not.toContain('SBC');
  });
  it('round-trips the URL token', () => {
    expect(isCity(cityToken('MAS'))).toBe(true);
    expect(anchorOf('~MAS')).toBe('MAS');
    expect(anchorOf('MAS')).toBe('MAS');
  });
  it('title-cases a typed name', () => expect(titleCase('  chennai ')).toBe('Chennai'));
});
