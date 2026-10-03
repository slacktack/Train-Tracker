// A "city" is a main station plus the other well-used stations around it. It is written ~CODE in
// URLs, where CODE is the main station, so the same members can be rebuilt anywhere.

export interface CityStation {
  code: string;
  name: string;
  lat: number;
  lng: number;
  pop: number;
}

export const CITY_PREFIX = '~';
export const isCity = (code: string | null | undefined): code is string => !!code && code.startsWith(CITY_PREFIX);
export const anchorOf = (code: string): string => (isCity(code) ? code.slice(1) : code);
export const cityToken = (anchor: string): string => `${CITY_PREFIX}${anchor}`;

const RADIUS_KM = 35;
const MIN_POP = 150;
const MAX_MEMBERS = 6;

function km(a: CityStation, b: CityStation): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const x = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}

/** The anchor plus nearby busy stations, busiest first. */
export function cityMembers(all: CityStation[], anchor: string): CityStation[] {
  const a = all.find((s) => s.code === anchor);
  if (!a) return [];
  const near = all.filter((s) => s.code !== anchor && s.pop >= MIN_POP && s.lat && s.lng && km(a, s) <= RADIUS_KM);
  return [a, ...near].sort((x, y) => y.pop - x.pop).slice(0, MAX_MEMBERS);
}

export const titleCase = (s: string): string => s.trim().toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
