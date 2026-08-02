import { ElevationPoint } from '@/types/geo';

export function sampleRouteCoordinates(
  routeGeometry: [number, number][],
  maxPoints = 40
): [number, number][] {
  if (!routeGeometry || routeGeometry.length === 0) return [];
  if (routeGeometry.length <= maxPoints) return routeGeometry;

  const step = Math.max(1, Math.ceil(routeGeometry.length / maxPoints));
  return routeGeometry.filter((_, i) => i % step === 0);
}

/**
 * Elevation profile via Open-Meteo's free elevation API (no key, batch
 * lookup, ~300ms). The legacy open-elevation.com service this replaced is
 * dead — requests hung or returned empty profiles.
 */
export async function getElevationProfile(
  routeGeometry: [number, number][],
  totalDistanceKm: number
): Promise<ElevationPoint[]> {
  const sampled = sampleRouteCoordinates(routeGeometry, 40);
  if (sampled.length === 0) return [];

  const lats = sampled.map(([, lat]) => lat.toFixed(5)).join(',');
  const lngs = sampled.map(([lng]) => lng.toFixed(5)).join(',');
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 86400 },
    } as RequestInit);
    if (!res.ok) throw new Error(`Open-Meteo elevation error: ${res.status}`);
    const json = (await res.json()) as { elevation: number[] };
    if (!Array.isArray(json.elevation) || json.elevation.length !== sampled.length) {
      throw new Error('Open-Meteo elevation: unexpected response shape');
    }

    return json.elevation.map((el, i) => ({
      lat: sampled[i][1],
      lng: sampled[i][0],
      elevationM: Math.round(el),
      distanceKm: Math.round((i / (json.elevation.length - 1 || 1)) * totalDistanceKm),
    }));
  } catch (e) {
    console.warn('Open-Meteo elevation fetch failed:', e);
    return [];
  }
}
