import { getSunInfo } from '@/lib/sun';

export type TimeTheme = 'light' | 'dark';

const INDIA_CENTER_LAT = 22.35;
const INDIA_CENTER_LNG = 78.96;

/** Day → light, night → dark, computed for India (IST). Safe for server + client. */
export function themeForIST(now: Date = new Date()): TimeTheme {
  return getSunInfo(INDIA_CENTER_LAT, INDIA_CENTER_LNG, now).isNight ? 'dark' : 'light';
}
