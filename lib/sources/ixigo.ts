import { fetchJson } from './http';

// Public web-client constants from ixigo's own JS bundle, not user credentials.
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  Accept: 'application/json',
  apiKey: 'ixiweb!2$',
  clientId: 'ixiweb',
  ixiSrc: 'ixiweb',
  Referer: 'https://www.ixigo.com/',
};

export interface StationInfo {
  platformCount: number | null;
  freeWifi: boolean | null;
  rating: number | null;
  nearestAirport: string | null;
}

export function parseStationInfo(json: { data?: Record<string, unknown> | null }): StationInfo | null {
  const d = json.data;
  if (!d) return null;
  const n = Number(d.platformCount);
  const r = Number(d.averageRating);
  return {
    platformCount: Number.isFinite(n) && n > 0 ? n : null,
    freeWifi: typeof d.freeWifi === 'boolean' ? d.freeWifi : null,
    rating: Number.isFinite(r) && r > 0 ? r : null,
    nearestAirport: typeof d.nearestAirport === 'string' && d.nearestAirport ? d.nearestAirport : null,
  };
}

export async function getStationInfo(code: string): Promise<StationInfo | null> {
  const json = await fetchJson<{ data?: Record<string, unknown> | null }>('ixigo', `https://www.ixigo.com/trains-info/v1/station/station-info?stationCode=${encodeURIComponent(code)}`, {
    headers: HEADERS,
    timeoutMs: 8_000,
  });
  return parseStationInfo(json);
}
