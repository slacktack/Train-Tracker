import { TerrainFeature } from '@/types/geo';

function buildOverpassQuery(minLat: number, minLng: number, maxLat: number, maxLng: number): string {
  const bbox = `${minLat},${minLng},${maxLat},${maxLng}`;
  return `[out:json][timeout:25];
(
  way["bridge"="yes"](${bbox});
  way["tunnel"="yes"](${bbox});
  relation["waterway"="river"](${bbox});
  way["waterway"="river"](${bbox});
  node["natural"="peak"](${bbox});
  node["tourism"="attraction"](${bbox});
  node["tourism"="viewpoint"](${bbox});
  node["place"="city"](${bbox});
  node["place"="town"](${bbox});
);
out center tags 50;`;
}

function mapOsmType(tags: Record<string, string>): TerrainFeature['type'] {
  if (tags.bridge === 'yes') return 'bridge';
  if (tags.tunnel === 'yes') return 'tunnel';
  if (tags.waterway === 'river') return 'river';
  if (tags.natural === 'peak') return 'mountain';
  if (tags.tourism === 'attraction' || tags.tourism === 'viewpoint') return 'tourist';
  if (tags.place === 'city' || tags.place === 'town') return 'city';
  return 'tourist';
}

function parseName(tags: Record<string, string>): string {
  return tags['name:en'] || tags.name || tags.description || 'Unnamed feature';
}

export function computeBoundingBox(routeCoords: [number, number][], padding = 0.05) {
  const lngs = routeCoords.map(([lng]) => lng);
  const lats = routeCoords.map(([, lat]) => lat);
  return {
    minLat: Math.min(...lats) - padding,
    maxLat: Math.max(...lats) + padding,
    minLng: Math.min(...lngs) - padding,
    maxLng: Math.max(...lngs) + padding,
  };
}

export async function getTerrainFeatures(routeCoords: [number, number][]): Promise<TerrainFeature[]> {
  if (!routeCoords || routeCoords.length === 0) return [];

  const { minLat, maxLat, minLng, maxLng } = computeBoundingBox(routeCoords);

  try {
    const query = buildOverpassQuery(minLat, minLng, maxLat, maxLng);
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      next: { revalidate: 86400 },
    } as any);

    if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);

    const json = await res.json();
    const elements: any[] = json?.elements || [];

    const seen = new Set<string>();
    const features: TerrainFeature[] = [];

    for (const el of elements) {
      const tags = el.tags || {};
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (!lat || !lng) continue;

      const name = parseName(tags);
      const type = mapOsmType(tags);
      const key = `${type}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);

      features.push({ type, name, lat, lng });
      if (features.length >= 30) break;
    }

    return features;
  } catch (e) {
    console.warn('Overpass terrain fetch failed:', e);
    return [];
  }
}
