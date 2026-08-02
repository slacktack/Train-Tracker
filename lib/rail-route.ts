import { getCached, setCached } from '@/lib/redis-cache';
import { fetchOverpassJson } from '@/lib/overpass-client';

interface RailNode {
  lat: number;
  lng: number;
}

const LEG_PADDING_DEG = 0.35;
const SNAP_DIST_KM = 40;
const RAIL_ROUTE_TTL_S = 7 * 24 * 3600;
const MAX_LEGS = 12;
const CONCURRENCY = 4;

let legCache: Map<string, RailNode[][]> | null = null;

function getLegCache(): Map<string, RailNode[][]> {
  if (!legCache) {
    legCache = new Map();
    const timer = setInterval(() => legCache?.clear(), 60 * 60 * 1000);
    timer.unref?.();
  }
  return legCache;
}

async function fetchRailWays(bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number }): Promise<RailNode[][]> {
  const { minLat, minLng, maxLat, maxLng } = bbox;
  const bboxStr = `${minLat},${minLng},${maxLat},${maxLng}`;
  const query = `[out:json][timeout:30];
way["railway"="rail"](${bboxStr});
out geom 1200;`;
  const json = (await fetchOverpassJson(query, { cache: 'no-store' })) as {
    elements?: Array<{ geometry?: Array<{ lat: number; lon: number }> }>;
  };
  const ways: RailNode[][] = [];
  for (const el of json.elements ?? []) {
    const geom = el.geometry ?? [];
    if (geom.length >= 2) {
      ways.push(geom.map((p) => ({ lat: p.lat, lng: p.lon })));
    }
  }
  return ways;
}

function nodeKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

interface Graph {
  nodes: Map<string, { lat: number; lng: number }>;
  edges: Map<string, Map<string, number>>;
}

function buildGraph(ways: RailNode[][]): Graph {
  const nodes: Graph['nodes'] = new Map();
  const edges: Graph['edges'] = new Map();
  for (const way of ways) {
    for (let i = 0; i + 1 < way.length; i++) {
      const a = way[i];
      const b = way[i + 1];
      const ka = nodeKey(a.lat, a.lng);
      const kb = nodeKey(b.lat, b.lng);
      if (!nodes.has(ka)) nodes.set(ka, a);
      if (!nodes.has(kb)) nodes.set(kb, b);
      const d = distKm(a, b);
      if (!edges.has(ka)) edges.set(ka, new Map());
      if (!edges.has(kb)) edges.set(kb, new Map());
      if (!edges.get(ka)!.has(kb) || edges.get(ka)!.get(kb)! > d) {
        edges.get(ka)!.set(kb, d);
        edges.get(kb)!.set(ka, d);
      }
    }
  }
  return { nodes, edges };
}

function snapToRail(
  graph: Graph,
  point: { lat: number; lng: number }
): { key: string; lat: number; lng: number } | null {
  let best: { key: string; lat: number; lng: number } | null = null;
  let bestDist = SNAP_DIST_KM;
  for (const [key, node] of Array.from(graph.nodes)) {
    const d = distKm(point, node);
    if (d < bestDist) {
      bestDist = d;
      best = { key, lat: node.lat, lng: node.lng };
    }
  }
  return best;
}

function dijkstra(graph: Graph, start: string, goal: string): string[] | null {
  if (start === goal) return [start];
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  dist.set(start, 0);
  const pq: Array<[number, string]> = [[0, start]];

  while (pq.length > 0) {
    pq.sort((x, y) => x[0] - y[0]);
    const [d, node] = pq.shift()!;
    if (visited.has(node)) continue;
    visited.add(node);
    if (node === goal) break;
    for (const [next, w] of Array.from(graph.edges.get(node) ?? new Map())) {
      const nd = d + w;
      if (nd < (dist.get(next) ?? Infinity)) {
        dist.set(next, nd);
        prev.set(next, node);
        pq.push([nd, next]);
      }
    }
  }
  if (!prev.has(goal)) return null;
  const path: string[] = [];
  let cur: string | undefined = goal;
  while (cur !== undefined) {
    path.unshift(cur);
    cur = prev.get(cur);
  }
  return path;
}

function legBetween(
  ways: RailNode[][],
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): [number, number][] | null {
  const graph = buildGraph(ways);
  const snapFrom = snapToRail(graph, from);
  const snapTo = snapToRail(graph, to);
  if (!snapFrom || !snapTo) return null;
  const path = dijkstra(graph, snapFrom.key, snapTo.key);
  if (!path || path.length < 2) return null;
  return path.map((key) => {
    const node = graph.nodes.get(key)!;
    return [node.lng, node.lat] as [number, number];
  });
}

function bboxForLeg(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): { minLat: number; minLng: number; maxLat: number; maxLng: number } {
  const minLat = Math.min(from.lat, to.lat) - LEG_PADDING_DEG;
  const maxLat = Math.max(from.lat, to.lat) + LEG_PADDING_DEG;
  const minLng = Math.min(from.lng, to.lng) - LEG_PADDING_DEG;
  const maxLng = Math.max(from.lng, to.lng) + LEG_PADDING_DEG;
  return { minLat, minLng, maxLat, maxLng };
}

function coordsValid(s: { lat: number; lng: number }): boolean {
  return Number.isFinite(s.lat) && Number.isFinite(s.lng) && Math.abs(s.lat) > 1 && Math.abs(s.lng) > 1;
}

function dedupe(coords: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const c of coords) {
    const last = out[out.length - 1];
    if (!last || last[0] !== c[0] || last[1] !== c[1]) out.push(c);
  }
  return out;
}

/**
 * Rail-aligned route geometry: for each consecutive station pair we fetch the
 * real `railway=rail` ways from OpenStreetMap (Overpass) inside a small corridor
 * bbox, snap the stations onto the rail graph and Dijkstra the shortest path
 * along the tracks. Legs run concurrently (bounded) and results stay ordered.
 * Falls back to straight-line legs when Overpass or the rail network is
 * unavailable (caller keeps its original geometry). Cached 7 days.
 */
export async function getRailRouteGeometry(
  trainNumber: string,
  stations: Array<{ lat: number; lng: number }>
): Promise<[number, number][] | null> {
  const known = stations.filter(coordsValid);
  if (known.length < 2) return null;

  // Include the station fingerprint so the 7-day cache invalidates when the
  // known-station set changes (e.g. station coords harvested later).
  const fingerprint = known
    .slice(0, Math.min(4, known.length))
    .map((s) => `${s.lat.toFixed(3)},${s.lng.toFixed(3)}`)
    .join('|');
  const cacheKey = `rail-route:${trainNumber}:${known.length}:${fingerprint}`;
  const cached = await getCached<[number, number][]>(cacheKey);
  if (cached && cached.length >= 2) return cached;

  const sampled = sampleStations(known, MAX_LEGS + 1);
  const legs = sampled.slice(0, -1).map((from, i) => ({ from, to: sampled[i + 1] }));

  try {
    const railRoute: [number, number][] = [];
    let usedRail = false;
    let railLegs = 0;
    const totalLegs = legs.length;

    const bboxes = legs.map((leg) => ({
      leg,
      bbox: bboxForLeg(leg.from, leg.to),
      key: (() => {
        const b = bboxForLeg(leg.from, leg.to);
        return `${b.minLat},${b.minLng},${b.maxLat},${b.maxLng}`;
      })(),
    }));

    const waysByKey = new Map<string, RailNode[][]>();
    for (let i = 0; i < bboxes.length; i += CONCURRENCY) {
      const batch = bboxes.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (entry) => {
          const cachedWays = getLegCache().get(entry.key);
          if (cachedWays) return { key: entry.key, ways: cachedWays };
          try {
            const ways = await fetchRailWays(entry.bbox);
            getLegCache().set(entry.key, ways);
            return { key: entry.key, ways };
          } catch {
            return { key: entry.key, ways: [] as RailNode[][] };
          }
        })
      );
      for (const r of results) waysByKey.set(r.key, r.ways);
    }

    for (const entry of bboxes) {
      const ways = waysByKey.get(entry.key) ?? [];
      const { from, to } = entry.leg;
      if (ways.length === 0) {
        railRoute.push([from.lng, from.lat], [to.lng, to.lat]);
        continue;
      }
      const path = legBetween(ways, from, to);
      if (path && path.length >= 2) {
        usedRail = true;
        railLegs += 1;
        if (railRoute.length > 0) {
          const tail = railRoute[railRoute.length - 1];
          const head = path[0];
          if (tail[0] !== head[0] || tail[1] !== head[1]) {
            railRoute.push(head);
          }
        }
        railRoute.push(...path.slice(1));
      } else {
        railRoute.push([from.lng, from.lat], [to.lng, to.lat]);
      }
    }

    const result = dedupe(railRoute);
    if (result.length < 2) return null;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[rail-route] ${trainNumber}: ${railLegs}/${totalLegs} legs used real rail geometry`);
    }
    if (usedRail) {
      await setCached(cacheKey, result, RAIL_ROUTE_TTL_S);
    }
    return result;
  } catch {
    return null;
  }
}

/** Pick up to max stations, evenly spaced, so long routes keep geometry while bounding Overpass legs. */
function sampleStations(stations: Array<{ lat: number; lng: number }>, max: number): Array<{ lat: number; lng: number }> {
  if (stations.length <= max) return stations;
  const out: Array<{ lat: number; lng: number }> = [];
  for (let i = 0; i < max; i++) {
    out.push(stations[Math.round((i * (stations.length - 1)) / (max - 1))]);
  }
  return out;
}

/**
 * Project a [lat, lng] point onto the nearest segment of a [lng, lat]
 * polyline. Returns the snapped point in [lng, lat] order plus the distance
 * in km from the original point to the line. null when the polyline has fewer
 * than two points.
 */
export function snapPointToPolyline(
  lat: number,
  lng: number,
  coords: [number, number][]
): { lng: number; lat: number; distanceKm: number } | null {
  if (!coords || coords.length < 2) return null;
  let best: { lng: number; lat: number; distanceKm: number } | null = null;
  for (let i = 0; i + 1 < coords.length; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];
    const dx = lng2 - lng1;
    const dy = lat2 - lat1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((lng - lng1) * dx + (lat - lat1) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const pLng = lng1 + t * dx;
    const pLat = lat1 + t * dy;
    const d = distKm({ lat, lng }, { lat: pLat, lng: pLng });
    if (!best || d < best.distanceKm) {
      best = { lng: pLng, lat: pLat, distanceKm: d };
    }
  }
  return best;
}
