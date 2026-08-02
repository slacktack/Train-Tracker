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

export async function getElevationProfile(
  routeGeometry: [number, number][],
  totalDistanceKm: number
): Promise<ElevationPoint[]> {
  const sampled = sampleRouteCoordinates(routeGeometry, 40);
  if (sampled.length === 0) return [];

  const locations = sampled.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));

  try {
    const res = await fetch('https://api.open-elevation.com/api/v1/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations }),
      next: { revalidate: 86400 },
    } as RequestInit);
    if (!res.ok) throw new Error(`Open-Elevation error: ${res.status}`);
    const json = await res.json();
    const results: { latitude: number; longitude: number; elevation: number }[] = json.results;

    return results.map((r, i) => ({
      lat: r.latitude,
      lng: r.longitude,
      elevationM: Math.round(r.elevation),
      distanceKm: Math.round((i / (results.length - 1 || 1)) * totalDistanceKm),
    }));
  } catch (e) {
    console.warn('Open-Elevation fetch failed:', e);
    return [];
  }
}
