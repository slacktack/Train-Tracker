# Train-Tracker MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Train-Tracker MVP — a glassy, Apple Maps/Flighty-grade live train tracking web app with live map, draggable bottom sheet, geo/weather context cards, elevation profile, search, favorites, and PWA basics.

**Architecture:** Next.js 14 App Router + TypeScript frontend, MapLibre GL JS/MapTiler for maps, Zustand + TanStack Query for state, Next.js API routes proxying RailRadar/Overpass/Open-Meteo/Open-Elevation with an Upstash Redis cache layer.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, MapLibre GL JS, Zustand, TanStack Query, Framer Motion, @upstash/redis, suncalc, Vitest, Playwright.

## Global Constraints

- Next.js 14 App Router (not Pages Router) — per `docs/superpowers/specs/2026-08-02-train-tracker-mvp-design.md` §2
- Adaptive light/dark theme, both themes equal design weight — spec §4
- Glassmorphism applied structurally only (bottom sheet, floating cards/search) — spec §4
- 8pt spacing grid, 16–24px corner radius — spec §4
- Tabular figures for live-updating numbers (speed, ETA, stats) — spec §4
- Bottom sheet has exactly 3 snap states: peek / half / full — spec §5
- Journey polling: 15–20s interval, paused when tab hidden — spec §7
- Route geometry / geo-context fetched once per trip, cached ~24h — spec §7
- Weather refetch every 5–10 min — spec §7
- API failures degrade gracefully — never a blank/broken screen — spec §8
- PWA: app-shell + static asset caching only, no background sync/push — spec §9
- Source reference for ported logic: `../RailGaadi/lib/railradar.ts`, `../RailGaadi/lib/overpass.ts`, `../RailGaadi/lib/trains-db.ts`, `../RailGaadi/types/train.ts`

---

## Task 1: Project Scaffold & Tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `.eslintrc.json`, `postcss.config.mjs`, `tailwind.config.ts`, `.env.example`, `.gitignore` (already exists, extend it)
- Create: `app/layout.tsx`, `app/page.tsx` (placeholder), `app/globals.css` (placeholder)

**Interfaces:**
- Produces: a runnable `npm run dev` Next.js app on port 3000, `npm test` (Vitest), `npm run test:e2e` (Playwright), `npm run lint`

- [ ] **Step 1: Scaffold Next.js app**

Run:
```bash
cd /Users/tushargautam/Documents/Train-TRacker/Train-Tracker
npx --yes create-next-app@14 . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --no-git
```
When prompted about existing files (`links.md`, `docs/`, `.gitignore`), choose to keep them / not overwrite.

- [ ] **Step 2: Install additional runtime dependencies**

Run:
```bash
npm install maplibre-gl @tanstack/react-query zustand framer-motion @upstash/redis suncalc @turf/turf clsx tailwind-merge class-variance-authority lucide-react
```

- [ ] **Step 3: Install dev dependencies**

Run:
```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test @types/suncalc
```

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test"
```

- [ ] **Step 5: Configure Playwright**

Run: `npx playwright install --with-deps chromium`

Create `playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
});
```

- [ ] **Step 6: Verify dev server boots**

Run: `npm run dev &` then `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` (retry for a few seconds if connection refused), then kill the dev server.
Expected: HTTP 200

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 14 app with Tailwind, Vitest, Playwright"
```

---

## Task 2: Environment & Config

**Files:**
- Create: `lib/env.ts`
- Modify: `.env.example`
- Create: `.env.local` (gitignored — populated from `../../api-keys.md`)

**Interfaces:**
- Produces: `env` object with typed, validated access to `RAILRADAR_API_KEY`, `NEXT_PUBLIC_MAPTILER_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

- [ ] **Step 1: Write env config**

Create `lib/env.ts`:
```ts
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  RAILRADAR_API_KEY: process.env.RAILRADAR_API_KEY ?? '',
  NEXT_PUBLIC_MAPTILER_API_KEY: process.env.NEXT_PUBLIC_MAPTILER_API_KEY ?? '',
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ?? '',
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
};

export function assertServerEnv() {
  required('RAILRADAR_API_KEY', env.RAILRADAR_API_KEY);
}
```

- [ ] **Step 2: Update `.env.example`**

```
RAILRADAR_API_KEY=
NEXT_PUBLIC_MAPTILER_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

- [ ] **Step 3: Populate `.env.local` from `api-keys.md`**

Run:
```bash
cat > .env.local << 'EOF'
RAILRADAR_API_KEY=rg_df83efbb7d99481e9c25db87b7143368
NEXT_PUBLIC_MAPTILER_API_KEY=PnHKB5g6MPUf5UUx1d33
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
EOF
```
Note: Upstash values remain blank until the user provisions a Redis instance (see `links.md`) — Task 5's Redis cache module must not crash the app when these are unset (fall back to a no-op cache).

- [ ] **Step 4: Verify `.env.local` is gitignored**

Run: `git check-ignore .env.local`
Expected: prints `.env.local` (confirms it's ignored)

- [ ] **Step 5: Commit**

```bash
git add lib/env.ts .env.example
git commit -m "feat: add typed env config"
```
(`.env.local` is not committed — it's gitignored.)

---

## Task 3: Core Data Types

**Files:**
- Create: `types/train.ts`
- Create: `types/geo.ts`

**Interfaces:**
- Produces: `Station`, `SearchResult`, `LiveLocation`, `LiveJourney` (train.ts); `TerrainFeature`, `WeatherSnapshot`, `ElevationPoint`, `SunInfo` (geo.ts) — consumed by every lib/hook/component task below

- [ ] **Step 1: Write `types/train.ts`**

```ts
export interface Station {
  code: string;
  name: string;
  lat: number;
  lng: number;
  scheduledArrival: string;
  scheduledDeparture: string;
  actualArrival?: string;
  actualDeparture?: string;
  delayMinutes: number;
  distanceKm: number;
  status: 'passed' | 'current' | 'upcoming';
  platform?: string;
  haltMinutes?: number;
}

export interface SearchResult {
  id: string;
  number: string;
  name: string;
  origin: { code: string; name: string };
  destination: { code: string; name: string };
  runsOn?: string[];
  duration?: string;
  departureTime?: string;
  arrivalTime?: string;
}

export interface LiveLocation {
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
  isMoving: boolean;
}

export interface LiveJourney {
  trainId: string;
  number: string;
  name: string;
  origin: { code: string; name: string };
  destination: { code: string; name: string };
  currentLocation: LiveLocation;
  status: 'running' | 'delayed' | 'on_time' | 'cancelled' | 'not_started' | 'completed';
  delayMinutes: number;
  speedKmh: number;
  distanceCoveredKm: number;
  remainingDistanceKm: number;
  totalDistanceKm: number;
  completionPercentage: number;
  lastUpdated: string;
  previousStation?: Station;
  currentStation?: Station;
  nextStation?: Station;
  ETA: string;
  stations: Station[];
  routeGeometry?: [number, number][];
  stale?: boolean;
}
```

- [ ] **Step 2: Write `types/geo.ts`**

```ts
export interface TerrainFeature {
  type: 'bridge' | 'tunnel' | 'river' | 'mountain' | 'tourist' | 'city';
  name: string;
  lat: number;
  lng: number;
  distanceKm?: number;
}

export interface WeatherSnapshot {
  tempC: number;
  condition: string;
  precipitationMm: number;
  windKmh: number;
  isRainingAhead: boolean;
}

export interface ElevationPoint {
  lat: number;
  lng: number;
  elevationM: number;
  distanceKm: number;
}

export interface SunInfo {
  sunrise: string;
  sunset: string;
  goldenHourStart: string;
  goldenHourEnd: string;
  isNight: boolean;
  isGoldenHour: boolean;
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add types/
git commit -m "feat: add core train and geo data types"
```

---

## Task 4: Local Trains Database

**Files:**
- Create: `lib/trains-db.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `TrainEntry` type, `TRAINS_DB: TrainEntry[]`, `searchLocalTrains(query: string): TrainEntry[]` — used by Task 6 (railradar search fallback)

- [ ] **Step 1: Copy the trains database verbatim**

Run:
```bash
cp ../RailGaadi/lib/trains-db.ts lib/trains-db.ts
```
This is a static list of ~90 popular Indian trains with a pure search function — no logic changes needed, it has no dependency on anything RailRadar-specific.

- [ ] **Step 2: Write a test**

Create `lib/trains-db.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { searchLocalTrains, TRAINS_DB } from './trains-db';

describe('searchLocalTrains', () => {
  it('returns popular trains for an empty query', () => {
    const results = searchLocalTrains('');
    expect(results.length).toBe(12);
  });

  it('matches by train number prefix', () => {
    const results = searchLocalTrains('12951');
    expect(results.some((t) => t.number === '12951')).toBe(true);
  });

  it('matches by name substring, case-insensitive', () => {
    const results = searchLocalTrains('rajdhani');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((t) => t.name.toLowerCase().includes('rajdhani'))).toBe(true);
  });

  it('caps results at 15', () => {
    const results = searchLocalTrains('e');
    expect(results.length).toBeLessThanOrEqual(15);
  });

  it('every entry has a unique train number', () => {
    const numbers = TRAINS_DB.map((t) => t.number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run lib/trains-db.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 4: Commit**

```bash
git add lib/trains-db.ts lib/trains-db.test.ts
git commit -m "feat: port local trains database with tests"
```

---

## Task 5: Redis Cache Layer

**Files:**
- Create: `lib/redis-cache.ts`
- Test: `lib/redis-cache.test.ts`

**Interfaces:**
- Consumes: `env.UPSTASH_REDIS_REST_URL`, `env.UPSTASH_REDIS_REST_TOKEN` from Task 2
- Produces: `getCached<T>(key: string): Promise<T | null>`, `setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void>` — used by all API route tasks (11, 12)

- [ ] **Step 1: Write the cache module**

Create `lib/redis-cache.ts`:
```ts
import { Redis } from '@upstash/redis';
import { env } from './env';

let redis: Redis | null = null;

function getClient(): Redis | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!redis) {
    redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

export async function getCached<T>(key: string): Promise<T | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const value = await client.get<T>(key);
    return value ?? null;
  } catch (e) {
    console.warn(`[redis-cache] get failed for ${key}:`, e);
    return null;
  }
}

export async function setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    await client.set(key, value, { ex: ttlSeconds });
  } catch (e) {
    console.warn(`[redis-cache] set failed for ${key}:`, e);
  }
}
```
This degrades to a no-op cache (never throws) when Redis env vars are unset — matches the note in Task 2 Step 3.

- [ ] **Step 2: Write a test using dependency injection via env mocking**

Create `lib/redis-cache.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('redis-cache with no Redis configured', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('getCached returns null when env vars are unset', async () => {
    vi.doMock('./env', () => ({ env: { UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '' } }));
    const { getCached } = await import('./redis-cache');
    const result = await getCached('some-key');
    expect(result).toBeNull();
  });

  it('setCached resolves without throwing when env vars are unset', async () => {
    vi.doMock('./env', () => ({ env: { UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '' } }));
    const { setCached } = await import('./redis-cache');
    await expect(setCached('some-key', { a: 1 }, 60)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run lib/redis-cache.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 4: Commit**

```bash
git add lib/redis-cache.ts lib/redis-cache.test.ts
git commit -m "feat: add Redis cache layer with graceful no-op fallback"
```

---

## Task 6: RailRadar API Client

**Files:**
- Create: `lib/railradar.ts`
- Test: `lib/railradar.test.ts`

**Interfaces:**
- Consumes: `Station`, `SearchResult`, `LiveJourney` from `types/train.ts` (Task 3); `TrainEntry`, `TRAINS_DB`, `searchLocalTrains` from `lib/trains-db.ts` (Task 4); `env.RAILRADAR_API_KEY` from `lib/env.ts` (Task 2)
- Produces: `searchTrains(query: string): Promise<SearchResult[]>`, `getLiveJourney(trainNumber: string): Promise<LiveJourney | null>` — used by Task 11 API routes. Throws `Error('QUOTA_EXCEEDED: ...')` on RailRadar 429.

- [ ] **Step 1: Port the client, adapting the import paths**

Copy the full content of `../RailGaadi/lib/railradar.ts` into `lib/railradar.ts`, with one change: replace
```ts
import { SearchResult, LiveJourney, Station } from '@/types/train';
import { env } from '@/config/env';
import { searchLocalTrains, TRAINS_DB, TrainEntry } from '@/lib/trains-db';
```
with
```ts
import { SearchResult, LiveJourney, Station } from '@/types/train';
import { env } from '@/lib/env';
import { searchLocalTrains, TRAINS_DB, TrainEntry } from '@/lib/trains-db';
```
(only the `env` import path changes — `config/env` becomes `lib/env` per this project's structure). All other logic (response normalization, `interpolatePolyline`, `generateFallbackJourney`, quota handling) is copied unchanged.

- [ ] **Step 2: Extract and test the pure `interpolatePolyline` logic**

This function is not exported in the source. Add `export` to its declaration in `lib/railradar.ts`:
```ts
export function interpolatePolyline(coords: [number, number][], pct: number): [number, number] {
```

Create `lib/railradar.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { interpolatePolyline } from './railradar';

describe('interpolatePolyline', () => {
  const line: [number, number][] = [
    [72.8193, 18.9696],
    [75.8648, 25.2138],
    [77.2194, 28.643],
  ];

  it('returns the first point at 0%', () => {
    expect(interpolatePolyline(line, 0)).toEqual([72.8193, 18.9696]);
  });

  it('returns the last point at 100%', () => {
    expect(interpolatePolyline(line, 100)).toEqual([77.2194, 28.643]);
  });

  it('returns a point between segment endpoints at 50%', () => {
    const [lng, lat] = interpolatePolyline(line, 50);
    expect(lng).toBeGreaterThan(72.8193);
    expect(lng).toBeLessThan(77.2194);
    expect(lat).toBeGreaterThan(18.9696);
    expect(lat).toBeLessThan(28.643);
  });

  it('returns a fallback point for an empty array', () => {
    expect(interpolatePolyline([], 50)).toEqual([77.2194, 28.643]);
  });

  it('returns the single point for a single-coordinate array', () => {
    expect(interpolatePolyline([[10, 20]], 50)).toEqual([10, 20]);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run lib/railradar.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add lib/railradar.ts lib/railradar.test.ts
git commit -m "feat: port RailRadar API client with polyline interpolation tests"
```

---

## Task 7: Overpass Terrain Client

**Files:**
- Create: `lib/overpass.ts`
- Test: `lib/overpass.test.ts`

**Interfaces:**
- Consumes: `TerrainFeature` from `types/geo.ts` (Task 3)
- Produces: `getTerrainFeatures(routeCoords: [number, number][]): Promise<TerrainFeature[]>` — used by Task 12 route-context API route

- [ ] **Step 1: Write the client (ported logic, adapted to `types/geo.ts`)**

Create `lib/overpass.ts`:
```ts
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
```
Note: unlike the old repo, the failure path returns `[]` (empty) rather than synthetic fake POIs — per spec §8, a context card that has no data should simply not render, never show fabricated data.

- [ ] **Step 2: Write tests for the pure bounding-box logic**

Create `lib/overpass.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeBoundingBox, getTerrainFeatures } from './overpass';

describe('computeBoundingBox', () => {
  it('pads the bounding box around a route', () => {
    const box = computeBoundingBox([
      [72.0, 19.0],
      [77.0, 28.0],
    ]);
    expect(box.minLng).toBeCloseTo(71.95);
    expect(box.maxLng).toBeCloseTo(77.05);
    expect(box.minLat).toBeCloseTo(18.95);
    expect(box.maxLat).toBeCloseTo(28.05);
  });
});

describe('getTerrainFeatures', () => {
  it('returns an empty array for an empty route', async () => {
    const result = await getTerrainFeatures([]);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run lib/overpass.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 4: Commit**

```bash
git add lib/overpass.ts lib/overpass.test.ts
git commit -m "feat: add Overpass terrain features client"
```

---

## Task 8: Open-Meteo Weather Client

**Files:**
- Create: `lib/openmeteo.ts`
- Test: `lib/openmeteo.test.ts`

**Interfaces:**
- Consumes: `WeatherSnapshot` from `types/geo.ts` (Task 3)
- Produces: `getWeatherSnapshot(lat: number, lng: number): Promise<WeatherSnapshot>`, `mapWeatherCode(code: number): string` — used by Task 12 weather API route

- [ ] **Step 1: Write the client**

Create `lib/openmeteo.ts`:
```ts
import { WeatherSnapshot } from '@/types/geo';

const WMO_CONDITIONS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm',
};

export function mapWeatherCode(code: number): string {
  return WMO_CONDITIONS[code] ?? 'Unknown';
}

export function isRainCode(code: number): boolean {
  return code >= 51 && code < 100;
}

export async function getWeatherSnapshot(lat: number, lng: number): Promise<WeatherSnapshot> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,wind_speed_10m,weather_code`;
  const res = await fetch(url, { next: { revalidate: 300 } } as any);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const json = await res.json();
  const current = json.current;
  const code = current.weather_code as number;

  return {
    tempC: Math.round(current.temperature_2m),
    condition: mapWeatherCode(code),
    precipitationMm: current.precipitation ?? 0,
    windKmh: Math.round(current.wind_speed_10m ?? 0),
    isRainingAhead: isRainCode(code),
  };
}
```

- [ ] **Step 2: Write tests for pure functions**

Create `lib/openmeteo.test.ts`:
```ts
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
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run lib/openmeteo.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 4: Commit**

```bash
git add lib/openmeteo.ts lib/openmeteo.test.ts
git commit -m "feat: add Open-Meteo weather client"
```

---

## Task 9: Open-Elevation Client

**Files:**
- Create: `lib/openelevation.ts`
- Test: `lib/openelevation.test.ts`

**Interfaces:**
- Consumes: `ElevationPoint` from `types/geo.ts` (Task 3)
- Produces: `sampleRouteCoordinates(routeGeometry: [number, number][], maxPoints: number): [number, number][]`, `getElevationProfile(routeGeometry: [number, number][], totalDistanceKm: number): Promise<ElevationPoint[]>` — used by Task 12 route-context API route

- [ ] **Step 1: Write the client**

Create `lib/openelevation.ts`:
```ts
import { ElevationPoint } from '@/types/geo';

export function sampleRouteCoordinates(
  routeGeometry: [number, number][],
  maxPoints = 40
): [number, number][] {
  if (!routeGeometry || routeGeometry.length === 0) return [];
  if (routeGeometry.length <= maxPoints) return routeGeometry;

  const step = Math.max(1, Math.floor(routeGeometry.length / maxPoints));
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
    } as any);
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
```

- [ ] **Step 2: Write tests**

Create `lib/openelevation.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { sampleRouteCoordinates } from './openelevation';

describe('sampleRouteCoordinates', () => {
  it('returns the input unchanged when already under maxPoints', () => {
    const coords: [number, number][] = [[0, 0], [1, 1], [2, 2]];
    expect(sampleRouteCoordinates(coords, 40)).toEqual(coords);
  });

  it('downsamples long routes to at most maxPoints', () => {
    const coords: [number, number][] = Array.from({ length: 500 }, (_, i) => [i, i]);
    const sampled = sampleRouteCoordinates(coords, 40);
    expect(sampled.length).toBeLessThanOrEqual(40);
    expect(sampled.length).toBeGreaterThan(0);
  });

  it('returns an empty array for an empty route', () => {
    expect(sampleRouteCoordinates([], 40)).toEqual([]);
  });

  it('always includes the first coordinate', () => {
    const coords: [number, number][] = Array.from({ length: 200 }, (_, i) => [i, i]);
    const sampled = sampleRouteCoordinates(coords, 40);
    expect(sampled[0]).toEqual(coords[0]);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run lib/openelevation.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 4: Commit**

```bash
git add lib/openelevation.ts lib/openelevation.test.ts
git commit -m "feat: add Open-Elevation client with coordinate sampling"
```

---

## Task 10: Sun Info Utility

**Files:**
- Create: `lib/sun.ts`
- Create: `types/suncalc.d.ts`
- Test: `lib/sun.test.ts`

**Interfaces:**
- Consumes: `SunInfo` from `types/geo.ts` (Task 3)
- Produces: `getSunInfo(lat: number, lng: number, date?: Date): SunInfo` — called directly client-side by `ContextCard` (Task 20), no API route needed (pure computation, zero network calls)

- [ ] **Step 1: Add minimal type declarations for `suncalc`**

Create `types/suncalc.d.ts`:
```ts
declare module 'suncalc' {
  export function getTimes(
    date: Date,
    lat: number,
    lng: number
  ): {
    sunrise: Date;
    sunriseEnd: Date;
    goldenHourEnd: Date;
    solarNoon: Date;
    goldenHour: Date;
    sunsetStart: Date;
    sunset: Date;
    dusk: Date;
    nauticalDusk: Date;
    night: Date;
    nadir: Date;
    nightEnd: Date;
    nauticalDawn: Date;
    dawn: Date;
  };
}
```

- [ ] **Step 2: Write the sun info utility**

Create `lib/sun.ts`:
```ts
import SunCalc from 'suncalc';
import { SunInfo } from '@/types/geo';

function formatIST(date: Date): string {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
}

export function getSunInfo(lat: number, lng: number, date: Date = new Date()): SunInfo {
  const times = SunCalc.getTimes(date, lat, lng);
  const now = date.getTime();

  const isNight = now < times.sunrise.getTime() || now > times.sunset.getTime();
  const inMorningGolden = now >= times.sunrise.getTime() && now <= times.goldenHourEnd.getTime();
  const inEveningGolden = now >= times.goldenHour.getTime() && now <= times.sunset.getTime();

  return {
    sunrise: formatIST(times.sunrise),
    sunset: formatIST(times.sunset),
    goldenHourStart: formatIST(times.goldenHour),
    goldenHourEnd: formatIST(times.goldenHourEnd),
    isNight,
    isGoldenHour: inMorningGolden || inEveningGolden,
  };
}
```

- [ ] **Step 3: Write tests using fixed dates/coordinates for New Delhi**

Create `lib/sun.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getSunInfo } from './sun';

const NEW_DELHI = { lat: 28.6139, lng: 77.209 };

describe('getSunInfo', () => {
  it('reports night for 2 AM IST', () => {
    const date = new Date('2026-06-15T02:00:00+05:30');
    const info = getSunInfo(NEW_DELHI.lat, NEW_DELHI.lng, date);
    expect(info.isNight).toBe(true);
  });

  it('reports not-night for local noon', () => {
    const date = new Date('2026-06-15T12:00:00+05:30');
    const info = getSunInfo(NEW_DELHI.lat, NEW_DELHI.lng, date);
    expect(info.isNight).toBe(false);
  });

  it('returns sunrise before sunset as formatted HH:MM strings', () => {
    const date = new Date('2026-06-15T12:00:00+05:30');
    const info = getSunInfo(NEW_DELHI.lat, NEW_DELHI.lng, date);
    expect(info.sunrise).toMatch(/^\d{2}:\d{2}$/);
    expect(info.sunset).toMatch(/^\d{2}:\d{2}$/);
  });

  it('is mutually exclusive: never both night and golden hour', () => {
    const date = new Date('2026-06-15T18:45:00+05:30');
    const info = getSunInfo(NEW_DELHI.lat, NEW_DELHI.lng, date);
    expect(info.isNight && info.isGoldenHour).toBe(false);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/sun.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/sun.ts lib/sun.test.ts types/suncalc.d.ts
git commit -m "feat: add sun info utility (sunrise/sunset/golden hour)"
```

---

## Task 11: API Routes — Search & Journey

**Files:**
- Create: `app/api/search/route.ts`
- Create: `app/api/journey/[trainNumber]/route.ts`

**Interfaces:**
- Consumes: `searchTrains`, `getLiveJourney` from `lib/railradar.ts` (Task 6); `getCached`, `setCached` from `lib/redis-cache.ts` (Task 5)
- Produces: `GET /api/search?q=<query>` → `SearchResult[]`; `GET /api/journey/<trainNumber>` → `LiveJourney` (with `stale: true` flag on cache-fallback) — used by Task 15 hooks

- [ ] **Step 1: Write the search route**

Create `app/api/search/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { searchTrains } from '@/lib/railradar';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const results = await searchTrains(q);
  return NextResponse.json(results);
}
```

- [ ] **Step 2: Write the journey route with cache fallback on error**

Create `app/api/journey/[trainNumber]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { getLiveJourney } from '@/lib/railradar';
import { getCached, setCached } from '@/lib/redis-cache';
import { LiveJourney } from '@/types/train';

export async function GET(
  _req: NextRequest,
  { params }: { params: { trainNumber: string } }
) {
  const { trainNumber } = params;
  const cacheKey = `journey:${trainNumber}`;

  try {
    const journey = await getLiveJourney(trainNumber);
    if (!journey) {
      return NextResponse.json({ error: 'Train not found' }, { status: 404 });
    }
    await setCached(cacheKey, journey, 20);
    return NextResponse.json(journey);
  } catch (err: any) {
    const isQuotaExceeded = typeof err?.message === 'string' && err.message.startsWith('QUOTA_EXCEEDED');
    const stale = await getCached<LiveJourney>(cacheKey);

    if (stale) {
      return NextResponse.json({ ...stale, stale: true });
    }
    if (isQuotaExceeded) {
      return NextResponse.json({ error: 'Rate limit exceeded, no cached data available' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Failed to fetch journey' }, { status: 502 });
  }
}
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Manual smoke test against the dev server**

Run (in one terminal): `npm run dev`
Run (in another): `curl -s "http://localhost:3000/api/search?q=rajdhani" | head -c 300`
Expected: a JSON array of train results (served from `searchLocalTrains` fallback if RailRadar's lookup endpoint is unreachable)

- [ ] **Step 5: Commit**

```bash
git add app/api/search app/api/journey
git commit -m "feat: add search and journey API routes with cache fallback"
```

---

## Task 12: API Routes — Route Context & Weather

**Files:**
- Create: `app/api/route-context/route.ts`
- Create: `app/api/weather/route.ts`

**Interfaces:**
- Consumes: `getTerrainFeatures` from `lib/overpass.ts` (Task 7); `getElevationProfile` from `lib/openelevation.ts` (Task 9); `getWeatherSnapshot` from `lib/openmeteo.ts` (Task 8); `getCached`, `setCached` from `lib/redis-cache.ts` (Task 5)
- Produces: `POST /api/route-context` (body `{ routeGeometry: [number,number][], totalDistanceKm: number, trainNumber: string }`) → `{ terrainFeatures: TerrainFeature[], elevationProfile: ElevationPoint[] }`, cached 24h; `GET /api/weather?lat=&lng=` → `WeatherSnapshot` — used by Task 15 hooks

- [ ] **Step 1: Write the route-context route**

Create `app/api/route-context/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { getTerrainFeatures } from '@/lib/overpass';
import { getElevationProfile } from '@/lib/openelevation';
import { getCached, setCached } from '@/lib/redis-cache';
import { TerrainFeature, ElevationPoint } from '@/types/geo';

interface RouteContextResponse {
  terrainFeatures: TerrainFeature[];
  elevationProfile: ElevationPoint[];
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const routeGeometry: [number, number][] = body.routeGeometry ?? [];
  const totalDistanceKm: number = body.totalDistanceKm ?? 0;
  const trainNumber: string = body.trainNumber ?? 'unknown';

  const cacheKey = `route-context:${trainNumber}`;
  const cached = await getCached<RouteContextResponse>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const [terrainFeatures, elevationProfile] = await Promise.all([
    getTerrainFeatures(routeGeometry),
    getElevationProfile(routeGeometry, totalDistanceKm),
  ]);

  const response: RouteContextResponse = { terrainFeatures, elevationProfile };
  await setCached(cacheKey, response, 86400);
  return NextResponse.json(response);
}
```

- [ ] **Step 2: Write the weather route**

Create `app/api/weather/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { getWeatherSnapshot } from '@/lib/openmeteo';

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get('lat') ?? '');
  const lng = parseFloat(req.nextUrl.searchParams.get('lng') ?? '');

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng query params are required' }, { status: 400 });
  }

  try {
    const snapshot = await getWeatherSnapshot(lat, lng);
    return NextResponse.json(snapshot);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 502 });
  }
}
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Manual smoke test**

Run (dev server running): `curl -s "http://localhost:3000/api/weather?lat=28.6139&lng=77.209"`
Expected: JSON with `tempC`, `condition`, `precipitationMm`, `windKmh`, `isRainingAhead`

- [ ] **Step 5: Commit**

```bash
git add app/api/route-context app/api/weather
git commit -m "feat: add route-context and weather API routes"
```

---

## Task 13: Design Tokens & Global Styles

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: Tailwind theme tokens (`colors.surface`, `colors.status.*`, `spacing` 8pt scale, `borderRadius`, `boxShadow`, `backdropBlur`) and CSS custom properties for light/dark themes — consumed by every component task (16–22)

- [ ] **Step 1: Define design tokens in `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
        },
        status: {
          onTime: '#34C759',
          minorDelay: '#FF9F0A',
          heavyDelay: '#FF3B30',
        },
        accent: 'rgb(var(--accent) / <alpha-value>)',
      },
      spacing: {
        '0.5x': '4px',
        '1x': '8px',
        '2x': '16px',
        '3x': '24px',
        '4x': '32px',
        '6x': '48px',
      },
      borderRadius: {
        card: '20px',
        sheet: '24px',
        pill: '999px',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.12)',
        card: '0 2px 12px 0 rgba(0, 0, 0, 0.08)',
      },
      backdropBlur: {
        glass: '24px',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: Define light/dark CSS custom properties in `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --surface: 250 250 252;
  --surface-raised: 255 255 255;
  --ink: 17 17 20;
  --ink-muted: 108 108 116;
  --accent: 10 132 255;
}

.dark {
  --surface: 10 10 12;
  --surface-raised: 24 24 28;
  --ink: 245 245 247;
  --ink-muted: 152 152 160;
  --accent: 64 156 255;
}

html,
body {
  @apply bg-surface text-ink;
  font-variant-numeric: tabular-nums;
}

.glass {
  @apply bg-surface-raised/70 backdrop-blur-glass shadow-glass;
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds with no Tailwind/CSS errors

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts app/globals.css
git commit -m "feat: add adaptive light/dark design tokens"
```

---

## Task 14: Zustand Stores

**Files:**
- Create: `store/useTrackingStore.ts`
- Create: `store/useFavoritesStore.ts`
- Test: `store/useFavoritesStore.test.ts`

**Interfaces:**
- Produces: `useTrackingStore` with `{ sheetState: 'peek'|'half'|'full', setSheetState }`; `useFavoritesStore` with `{ favorites: TrainEntry[], addFavorite, removeFavorite, isFavorite }` — used by Task 17 (BottomSheet), Task 22 (Favorites page)

- [ ] **Step 1: Write the tracking store**

Create `store/useTrackingStore.ts`:
```ts
import { create } from 'zustand';

export type SheetState = 'peek' | 'half' | 'full';

interface TrackingStore {
  sheetState: SheetState;
  setSheetState: (state: SheetState) => void;
}

export const useTrackingStore = create<TrackingStore>((set) => ({
  sheetState: 'peek',
  setSheetState: (state) => set({ sheetState: state }),
}));
```

- [ ] **Step 2: Write the favorites store with localStorage persistence**

Create `store/useFavoritesStore.ts`:
```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TrainEntry } from '@/lib/trains-db';

interface FavoritesStore {
  favorites: TrainEntry[];
  addFavorite: (train: TrainEntry) => void;
  removeFavorite: (trainNumber: string) => void;
  isFavorite: (trainNumber: string) => boolean;
}

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favorites: [],
      addFavorite: (train) =>
        set((s) => (s.favorites.some((t) => t.number === train.number) ? s : { favorites: [...s.favorites, train] })),
      removeFavorite: (trainNumber) =>
        set((s) => ({ favorites: s.favorites.filter((t) => t.number !== trainNumber) })),
      isFavorite: (trainNumber) => get().favorites.some((t) => t.number === trainNumber),
    }),
    { name: 'train-tracker-favorites' }
  )
);
```

- [ ] **Step 3: Write a test for the favorites store logic**

Create `store/useFavoritesStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useFavoritesStore } from './useFavoritesStore';

const sampleTrain = { number: '12951', name: 'Rajdhani Express', from: 'Mumbai Central', fromCode: 'MMCT', to: 'New Delhi', toCode: 'NDLS' };

describe('useFavoritesStore', () => {
  beforeEach(() => {
    useFavoritesStore.setState({ favorites: [] });
  });

  it('adds a favorite', () => {
    useFavoritesStore.getState().addFavorite(sampleTrain);
    expect(useFavoritesStore.getState().favorites).toHaveLength(1);
  });

  it('does not add duplicate favorites', () => {
    useFavoritesStore.getState().addFavorite(sampleTrain);
    useFavoritesStore.getState().addFavorite(sampleTrain);
    expect(useFavoritesStore.getState().favorites).toHaveLength(1);
  });

  it('removes a favorite by train number', () => {
    useFavoritesStore.getState().addFavorite(sampleTrain);
    useFavoritesStore.getState().removeFavorite('12951');
    expect(useFavoritesStore.getState().favorites).toHaveLength(0);
  });

  it('reports isFavorite correctly', () => {
    expect(useFavoritesStore.getState().isFavorite('12951')).toBe(false);
    useFavoritesStore.getState().addFavorite(sampleTrain);
    expect(useFavoritesStore.getState().isFavorite('12951')).toBe(true);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run store/useFavoritesStore.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add store/
git commit -m "feat: add tracking and favorites Zustand stores"
```

---

## Task 15: TanStack Query Hooks & Provider

**Files:**
- Create: `providers/QueryProvider.tsx`
- Create: `hooks/useJourney.ts`
- Create: `hooks/useRouteContext.ts`
- Create: `hooks/useWeather.ts`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `LiveJourney` (Task 3), API routes from Tasks 11–12
- Produces: `useJourney(trainNumber: string)`, `useRouteContext(routeGeometry, totalDistanceKm, trainNumber, enabled)`, `useWeather(lat, lng, enabled)` — used by Task 22 (Tracking page)

- [ ] **Step 1: Write the QueryClientProvider**

Create `providers/QueryProvider.tsx`:
```tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  }));

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 2: Wire the provider into the root layout**

Modify `app/layout.tsx` to wrap `children` with `<QueryProvider>`:
```tsx
import { QueryProvider } from '@/providers/QueryProvider';
import './globals.css';

export const metadata = {
  title: 'Train-Tracker',
  description: 'Live train tracking, beautifully.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Write `useJourney` with visibility-aware polling**

Create `hooks/useJourney.ts`:
```ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { LiveJourney } from '@/types/train';

async function fetchJourney(trainNumber: string): Promise<LiveJourney> {
  const res = await fetch(`/api/journey/${trainNumber}`);
  if (!res.ok) throw new Error(`Failed to fetch journey: ${res.status}`);
  return res.json();
}

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const handler = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);
  return visible;
}

export function useJourney(trainNumber: string) {
  const visible = usePageVisible();

  return useQuery({
    queryKey: ['journey', trainNumber],
    queryFn: () => fetchJourney(trainNumber),
    refetchInterval: visible ? 18_000 : false,
    enabled: !!trainNumber,
  });
}
```

- [ ] **Step 4: Write `useRouteContext`**

Create `hooks/useRouteContext.ts`:
```ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { TerrainFeature, ElevationPoint } from '@/types/geo';

interface RouteContextResponse {
  terrainFeatures: TerrainFeature[];
  elevationProfile: ElevationPoint[];
}

async function fetchRouteContext(
  routeGeometry: [number, number][],
  totalDistanceKm: number,
  trainNumber: string
): Promise<RouteContextResponse> {
  const res = await fetch('/api/route-context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ routeGeometry, totalDistanceKm, trainNumber }),
  });
  if (!res.ok) throw new Error(`Failed to fetch route context: ${res.status}`);
  return res.json();
}

export function useRouteContext(
  routeGeometry: [number, number][] | undefined,
  totalDistanceKm: number,
  trainNumber: string,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['route-context', trainNumber],
    queryFn: () => fetchRouteContext(routeGeometry ?? [], totalDistanceKm, trainNumber),
    enabled: enabled && !!routeGeometry && routeGeometry.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
```

- [ ] **Step 5: Write `useWeather`**

Create `hooks/useWeather.ts`:
```ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { WeatherSnapshot } from '@/types/geo';

async function fetchWeather(lat: number, lng: number): Promise<WeatherSnapshot> {
  const res = await fetch(`/api/weather?lat=${lat}&lng=${lng}`);
  if (!res.ok) throw new Error(`Failed to fetch weather: ${res.status}`);
  return res.json();
}

export function useWeather(lat: number | undefined, lng: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['weather', lat, lng],
    queryFn: () => fetchWeather(lat as number, lng as number),
    enabled: enabled && lat !== undefined && lng !== undefined,
    refetchInterval: 7 * 60 * 1000,
  });
}
```

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add providers/ hooks/ app/layout.tsx
git commit -m "feat: add TanStack Query provider and data hooks"
```

---

## Task 16: UI Primitives

**Files:**
- Create: `components/ui/Button.tsx`
- Create: `components/ui/StatusPill.tsx`
- Create: `lib/cn.ts`

**Interfaces:**
- Produces: `cn(...)` classname merge helper; `<Button>`, `<StatusPill status={LiveJourney['status']} delayMinutes={number} />` — used by Tasks 19–22

- [ ] **Step 1: Write the classname merge helper**

Create `lib/cn.ts`:
```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Write the Button primitive**

Create `components/ui/Button.tsx`:
```tsx
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-pill px-2x py-1x text-sm font-medium transition-colors',
        variant === 'primary' && 'bg-accent text-white hover:opacity-90',
        variant === 'ghost' && 'bg-transparent text-ink hover:bg-surface-raised',
        className
      )}
      {...props}
    />
  )
);
Button.displayName = 'Button';
```

- [ ] **Step 3: Write the StatusPill primitive**

Create `components/ui/StatusPill.tsx`:
```tsx
import { LiveJourney } from '@/types/train';
import { cn } from '@/lib/cn';

interface StatusPillProps {
  status: LiveJourney['status'];
  delayMinutes: number;
}

export function statusLabel(status: LiveJourney['status'], delayMinutes: number): {
  label: string;
  colorClass: string;
} {
  if (status === 'cancelled') return { label: 'Cancelled', colorClass: 'bg-status-heavyDelay' };
  if (status === 'not_started') return { label: 'Not started', colorClass: 'bg-ink-muted' };
  if (status === 'completed') return { label: 'Completed', colorClass: 'bg-ink-muted' };
  if (delayMinutes >= 15) return { label: `Delayed ${delayMinutes}m`, colorClass: 'bg-status-heavyDelay' };
  if (delayMinutes >= 1) return { label: `Delayed ${delayMinutes}m`, colorClass: 'bg-status-minorDelay' };
  return { label: 'On time', colorClass: 'bg-status-onTime' };
}

export function StatusPill({ status, delayMinutes }: StatusPillProps) {
  const { label, colorClass } = statusLabel(status, delayMinutes);
  return (
    <span className={cn('inline-flex items-center gap-1x rounded-pill px-2x py-0.5x text-xs font-semibold text-white', colorClass)}>
      {label}
    </span>
  );
}
```

- [ ] **Step 4: Write a test for the pure `statusLabel` logic**

Create `components/ui/StatusPill.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { statusLabel } from './StatusPill';

describe('statusLabel', () => {
  it('labels on-time trains', () => {
    expect(statusLabel('running', 0).label).toBe('On time');
  });

  it('labels minor delays under 15 minutes as amber', () => {
    const result = statusLabel('running', 6);
    expect(result.label).toBe('Delayed 6m');
    expect(result.colorClass).toBe('bg-status-minorDelay');
  });

  it('labels delays of 15+ minutes as heavy/red', () => {
    const result = statusLabel('running', 20);
    expect(result.colorClass).toBe('bg-status-heavyDelay');
  });

  it('labels cancelled trains distinctly', () => {
    expect(statusLabel('cancelled', 0).label).toBe('Cancelled');
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run components/ui/StatusPill.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/cn.ts components/ui/
git commit -m "feat: add Button and StatusPill UI primitives"
```

---

## Task 17: Bottom Sheet Component

**Files:**
- Create: `components/BottomSheet/snapPhysics.ts`
- Create: `components/BottomSheet/BottomSheet.tsx`
- Test: `components/BottomSheet/snapPhysics.test.ts`

**Interfaces:**
- Consumes: `SheetState` from `store/useTrackingStore.ts` (Task 14)
- Produces: `SNAP_HEIGHTS`, `resolveSnapState(currentHeightFraction, velocity, flingThreshold?)`; `<BottomSheet peek={ReactNode} half={ReactNode} full={ReactNode} />` — used by Task 22 (Tracking page)

- [ ] **Step 1: Write the pure snap-resolution logic (testable without DOM/gestures)**

Create `components/BottomSheet/snapPhysics.ts`:
```ts
export type SheetSnapState = 'peek' | 'half' | 'full';

export const SNAP_HEIGHTS: Record<SheetSnapState, number> = {
  peek: 0.12,
  half: 0.45,
  full: 0.9,
};

const ORDER: SheetSnapState[] = ['peek', 'half', 'full'];

export function resolveSnapState(
  currentHeightFraction: number,
  velocity: number,
  flingThreshold = 500
): SheetSnapState {
  if (velocity > flingThreshold) {
    const currentIdx = ORDER.findIndex((s) => SNAP_HEIGHTS[s] >= currentHeightFraction);
    const idx = currentIdx === -1 ? ORDER.length - 1 : currentIdx;
    return ORDER[Math.max(0, idx - 1)];
  }
  if (velocity < -flingThreshold) {
    const currentIdx = ORDER.findIndex((s) => SNAP_HEIGHTS[s] >= currentHeightFraction);
    const idx = currentIdx === -1 ? ORDER.length - 1 : currentIdx;
    return ORDER[Math.min(ORDER.length - 1, idx + 1)];
  }

  let closest: SheetSnapState = 'peek';
  let closestDist = Infinity;
  for (const state of ORDER) {
    const dist = Math.abs(SNAP_HEIGHTS[state] - currentHeightFraction);
    if (dist < closestDist) {
      closestDist = dist;
      closest = state;
    }
  }
  return closest;
}
```

- [ ] **Step 2: Write tests**

Create `components/BottomSheet/snapPhysics.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { resolveSnapState, SNAP_HEIGHTS } from './snapPhysics';

describe('resolveSnapState', () => {
  it('snaps to nearest state with no fling', () => {
    expect(resolveSnapState(0.13, 0)).toBe('peek');
    expect(resolveSnapState(0.4, 0)).toBe('half');
    expect(resolveSnapState(0.85, 0)).toBe('full');
  });

  it('a fast downward fling drops one level from half', () => {
    expect(resolveSnapState(SNAP_HEIGHTS.half, 800)).toBe('peek');
  });

  it('a fast upward fling raises one level from half', () => {
    expect(resolveSnapState(SNAP_HEIGHTS.half, -800)).toBe('full');
  });

  it('does not overshoot past full on an upward fling from full', () => {
    expect(resolveSnapState(SNAP_HEIGHTS.full, -800)).toBe('full');
  });

  it('does not undershoot past peek on a downward fling from peek', () => {
    expect(resolveSnapState(SNAP_HEIGHTS.peek, 800)).toBe('peek');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run components/BottomSheet/snapPhysics.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 4: Write the BottomSheet component using Framer Motion drag**

Create `components/BottomSheet/BottomSheet.tsx`:
```tsx
'use client';

import { motion, useAnimation, PanInfo } from 'framer-motion';
import { useEffect } from 'react';
import { useTrackingStore } from '@/store/useTrackingStore';
import { resolveSnapState, SNAP_HEIGHTS } from './snapPhysics';
import { cn } from '@/lib/cn';

interface BottomSheetProps {
  peek: React.ReactNode;
  half: React.ReactNode;
  full: React.ReactNode;
}

export function BottomSheet({ peek, half, full }: BottomSheetProps) {
  const { sheetState, setSheetState } = useTrackingStore();
  const controls = useAnimation();

  useEffect(() => {
    controls.start({ y: `${(1 - SNAP_HEIGHTS[sheetState]) * 100}%` });
  }, [sheetState, controls]);

  function handleDragEnd(_: any, info: PanInfo) {
    const viewportHeight = window.innerHeight;
    const currentY = info.point.y;
    const currentHeightFraction = 1 - currentY / viewportHeight;
    const next = resolveSnapState(currentHeightFraction, -info.velocity.y);
    setSheetState(next);
  }

  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.15}
      onDragEnd={handleDragEnd}
      animate={controls}
      initial={{ y: `${(1 - SNAP_HEIGHTS.peek) * 100}%` }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className={cn(
        'glass fixed left-0 right-0 bottom-0 z-20 rounded-t-sheet',
        'flex flex-col overflow-hidden'
      )}
      style={{ height: '90vh' }}
    >
      <div className="mx-auto mt-1x h-1 w-10 shrink-0 rounded-pill bg-ink-muted/40" />
      <div className="overflow-y-auto px-3x pb-6x pt-2x">
        {peek}
        {(sheetState === 'half' || sheetState === 'full') && half}
        {sheetState === 'full' && full}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add components/BottomSheet/
git commit -m "feat: add BottomSheet component with tested snap physics"
```

---

## Task 18: MapCanvas & TrainMarker

**Files:**
- Create: `components/Map/MapCanvas.tsx`
- Create: `components/Map/TrainMarker.tsx`
- Create: `components/Map/mapStyle.ts`

**Interfaces:**
- Consumes: `LiveJourney` from `types/train.ts` (Task 3), `env.NEXT_PUBLIC_MAPTILER_API_KEY` (Task 2)
- Produces: `getMapStyleUrl(theme: 'light'|'dark'): string`; `<MapCanvas journey={LiveJourney} />` — used by Task 22 (Tracking page)

- [ ] **Step 1: Write the theme-aware map style resolver**

Create `components/Map/mapStyle.ts`:
```ts
export function getMapStyleUrl(theme: 'light' | 'dark', apiKey: string): string {
  const styleId = theme === 'dark' ? 'streets-v2-dark' : 'streets-v2-light';
  return `https://api.maptiler.com/maps/${styleId}/style.json?key=${apiKey}`;
}
```

- [ ] **Step 2: Write the TrainMarker component**

Create `components/Map/TrainMarker.tsx`:
```tsx
interface TrainMarkerProps {
  heading: number;
  isMoving: boolean;
}

export function TrainMarker({ heading, isMoving }: TrainMarkerProps) {
  return (
    <div
      className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-accent shadow-card"
      style={{ transform: `rotate(${heading}deg)` }}
    >
      <div className={isMoving ? 'h-2 w-2 animate-pulse rounded-full bg-white' : 'h-2 w-2 rounded-full bg-white'} />
    </div>
  );
}
```

- [ ] **Step 3: Write the MapCanvas component**

Create `components/Map/MapCanvas.tsx`:
```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LiveJourney } from '@/types/train';
import { getMapStyleUrl } from './mapStyle';
import { TrainMarker } from './TrainMarker';
import { createRoot } from 'react-dom/client';

interface MapCanvasProps {
  journey: LiveJourney;
}

function statusToRouteColor(delayMinutes: number): string {
  if (delayMinutes >= 15) return '#FF3B30';
  if (delayMinutes >= 1) return '#FF9F0A';
  return '#34C759';
}

export function MapCanvas({ journey }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setTheme(mq.matches ? 'dark' : 'light');
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY ?? '';

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyleUrl(theme, apiKey),
      center: [journey.currentLocation.lng, journey.currentLocation.lat],
      zoom: 7,
    });
    mapRef.current = map;

    map.on('load', () => {
      if (journey.routeGeometry && journey.routeGeometry.length > 1) {
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: journey.routeGeometry } },
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          paint: { 'line-color': statusToRouteColor(journey.delayMinutes), 'line-width': 4 },
        });
      }

      const el = document.createElement('div');
      createRoot(el).render(
        <TrainMarker heading={journey.currentLocation.heading} isMoving={journey.currentLocation.isMoving} />
      );
      markerRef.current = new maplibregl.Marker({ element: el }).setLngLat([
        journey.currentLocation.lng,
        journey.currentLocation.lat,
      ]).addTo(map);
    });

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  useEffect(() => {
    markerRef.current?.setLngLat([journey.currentLocation.lng, journey.currentLocation.lat]);
    mapRef.current?.easeTo({ center: [journey.currentLocation.lng, journey.currentLocation.lat], duration: 800 });
  }, [journey.currentLocation.lat, journey.currentLocation.lng]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
```

- [ ] **Step 4: Write a test for the pure `statusToRouteColor`/style-url logic**

Create `components/Map/mapStyle.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getMapStyleUrl } from './mapStyle';

describe('getMapStyleUrl', () => {
  it('uses the dark style id for dark theme', () => {
    expect(getMapStyleUrl('dark', 'KEY')).toContain('streets-v2-dark');
  });

  it('uses the light style id for light theme', () => {
    expect(getMapStyleUrl('light', 'KEY')).toContain('streets-v2-light');
  });

  it('includes the API key as a query param', () => {
    expect(getMapStyleUrl('light', 'abc123')).toContain('key=abc123');
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run components/Map/mapStyle.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add components/Map/
git commit -m "feat: add MapCanvas and TrainMarker with theme-aware MapTiler styles"
```

---

## Task 19: TripStatBadge & ElevationChart

**Files:**
- Create: `components/TripStatBadge.tsx`
- Create: `components/ElevationChart.tsx`

**Interfaces:**
- Consumes: `LiveJourney`, `ElevationPoint[]`
- Produces: `<TripStatBadge label={string} value={string} />`; `<ElevationChart points={ElevationPoint[]} />` — used by Task 22 (Tracking page)

- [ ] **Step 1: Write TripStatBadge**

Create `components/TripStatBadge.tsx`:
```tsx
interface TripStatBadgeProps {
  label: string;
  value: string;
}

export function TripStatBadge({ label, value }: TripStatBadgeProps) {
  return (
    <div className="flex flex-col gap-0.5x rounded-card bg-surface-raised px-2x py-1x shadow-card">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}
```

- [ ] **Step 2: Write ElevationChart as an SVG polyline (no chart library dependency needed for a single line)**

Create `components/ElevationChart.tsx`:
```tsx
import { ElevationPoint } from '@/types/geo';

interface ElevationChartProps {
  points: ElevationPoint[];
  width?: number;
  height?: number;
}

export function buildElevationPath(points: ElevationPoint[], width: number, height: number): string {
  if (points.length === 0) return '';
  const elevations = points.map((p) => p.elevationM);
  const minEl = Math.min(...elevations);
  const maxEl = Math.max(...elevations);
  const range = maxEl - minEl || 1;
  const maxDist = points[points.length - 1].distanceKm || 1;

  return points
    .map((p, i) => {
      const x = (p.distanceKm / maxDist) * width;
      const y = height - ((p.elevationM - minEl) / range) * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function ElevationChart({ points, width = 320, height = 80 }: ElevationChartProps) {
  if (points.length === 0) {
    return null;
  }
  const path = buildElevationPath(points, width, height);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="text-accent">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 3: Write a test for `buildElevationPath`**

Create `components/ElevationChart.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildElevationPath } from './ElevationChart';

describe('buildElevationPath', () => {
  it('returns an empty string for no points', () => {
    expect(buildElevationPath([], 100, 100)).toBe('');
  });

  it('starts with M and uses L for subsequent points', () => {
    const points = [
      { lat: 0, lng: 0, elevationM: 100, distanceKm: 0 },
      { lat: 0, lng: 0, elevationM: 200, distanceKm: 50 },
      { lat: 0, lng: 0, elevationM: 150, distanceKm: 100 },
    ];
    const path = buildElevationPath(points, 100, 100);
    expect(path.startsWith('M')).toBe(true);
    expect(path.split(' ').length).toBe(3);
  });

  it('places the lowest elevation point at the bottom (max y)', () => {
    const points = [
      { lat: 0, lng: 0, elevationM: 0, distanceKm: 0 },
      { lat: 0, lng: 0, elevationM: 1000, distanceKm: 100 },
    ];
    const path = buildElevationPath(points, 100, 100);
    const firstY = parseFloat(path.split(' ')[0].split(',')[1]);
    expect(firstY).toBeCloseTo(100);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run components/ElevationChart.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/TripStatBadge.tsx components/ElevationChart.tsx components/ElevationChart.test.ts
git commit -m "feat: add TripStatBadge and ElevationChart components"
```

---

## Task 20: ContextCard & StationRow

**Files:**
- Create: `components/ContextCard.tsx`
- Create: `components/StationRow.tsx`

**Interfaces:**
- Consumes: `TerrainFeature`, `WeatherSnapshot`, `SunInfo` from `types/geo.ts`; `Station` from `types/train.ts`; `getSunInfo` from `lib/sun.ts` (Task 10)
- Produces: `<ContextCard variant="river"|"mountain"|"tunnel"|"weather"|"sun" ... />`; `<StationRow station={Station} />` — used by Task 22

- [ ] **Step 1: Write ContextCard with discriminated union props**

Create `components/ContextCard.tsx`:
```tsx
import { TerrainFeature, WeatherSnapshot, SunInfo } from '@/types/geo';

type ContextCardProps =
  | { variant: 'terrain'; feature: TerrainFeature }
  | { variant: 'weather'; weather: WeatherSnapshot }
  | { variant: 'sun'; sun: SunInfo };

const TERRAIN_LABELS: Record<TerrainFeature['type'], string> = {
  river: 'Crossing',
  mountain: 'Near',
  tunnel: 'Passing through',
  bridge: 'Crossing',
  tourist: 'Nearby',
  city: 'Passing',
};

export function ContextCard(props: ContextCardProps) {
  if (props.variant === 'terrain') {
    const { feature } = props;
    return (
      <div className="glass rounded-card px-2x py-1x">
        <p className="text-xs text-ink-muted">{TERRAIN_LABELS[feature.type]}</p>
        <p className="text-base font-semibold">{feature.name}</p>
      </div>
    );
  }

  if (props.variant === 'weather') {
    const { weather } = props;
    return (
      <div className="glass rounded-card px-2x py-1x">
        <p className="text-xs text-ink-muted">{weather.condition}</p>
        <p className="text-base font-semibold tabular-nums">{weather.tempC}°C</p>
        {weather.isRainingAhead && <p className="text-xs text-status-minorDelay">Rain ahead</p>}
      </div>
    );
  }

  const { sun } = props;
  return (
    <div className="glass rounded-card px-2x py-1x">
      <p className="text-xs text-ink-muted">{sun.isNight ? 'Night journey' : sun.isGoldenHour ? 'Golden hour' : 'Daytime'}</p>
      <p className="text-base font-semibold tabular-nums">
        Sunrise {sun.sunrise} · Sunset {sun.sunset}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Write StationRow**

Create `components/StationRow.tsx`:
```tsx
import { Station } from '@/types/train';
import { cn } from '@/lib/cn';

interface StationRowProps {
  station: Station;
}

export function StationRow({ station }: StationRowProps) {
  return (
    <div className="flex items-center justify-between border-b border-ink-muted/10 py-1x">
      <div className="flex items-center gap-1x">
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            station.status === 'passed' && 'bg-ink-muted/40',
            station.status === 'current' && 'bg-accent animate-pulse',
            station.status === 'upcoming' && 'bg-ink-muted/20'
          )}
        />
        <div>
          <p className="text-sm font-medium">{station.name}</p>
          {station.platform && <p className="text-xs text-ink-muted">Platform {station.platform}</p>}
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm tabular-nums">{station.actualArrival ?? station.scheduledArrival}</p>
        {station.delayMinutes > 0 && (
          <p className="text-xs text-status-minorDelay">+{station.delayMinutes}m</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add components/ContextCard.tsx components/StationRow.tsx
git commit -m "feat: add ContextCard and StationRow components"
```

---

## Task 21: SearchBar & Home Page

**Files:**
- Create: `components/SearchBar.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `SearchResult` from `types/train.ts`, `useFavoritesStore` from Task 14
- Produces: functioning Home screen at `/` — search box, results list, favorites list, tap-to-navigate to `/track/[trainNumber]`

- [ ] **Step 1: Write SearchBar**

Create `components/SearchBar.tsx`:
```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SearchResult } from '@/types/train';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (res.ok) setResults(await res.json());
      } catch {
        // aborted or network error — keep previous results, no error UI needed for a debounced search
      }
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="glass w-full max-w-md rounded-card p-2x">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search train number or name"
        className="w-full bg-transparent text-base outline-none placeholder:text-ink-muted"
      />
      {results.length > 0 && (
        <ul className="mt-2x max-h-80 overflow-y-auto">
          {results.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => router.push(`/track/${r.number}`)}
                className="flex w-full flex-col items-start rounded-card px-1x py-1x text-left hover:bg-surface-raised"
              >
                <span className="text-sm font-semibold">{r.number} · {r.name}</span>
                {r.origin.name && r.destination.name && (
                  <span className="text-xs text-ink-muted">{r.origin.name} → {r.destination.name}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the Home page**

Modify `app/page.tsx`:
```tsx
import { SearchBar } from '@/components/SearchBar';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4x bg-surface px-3x">
      <h1 className="text-2xl font-semibold">Train-Tracker</h1>
      <SearchBar />
    </main>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add components/SearchBar.tsx app/page.tsx
git commit -m "feat: add SearchBar and Home page"
```

---

## Task 22: Tracking Page

**Files:**
- Create: `app/track/[trainNumber]/page.tsx`
- Create: `app/track/[trainNumber]/TrackingScreen.tsx`

**Interfaces:**
- Consumes: `useJourney`, `useRouteContext`, `useWeather` (Task 15); `MapCanvas` (Task 18); `BottomSheet` (Task 17); `TripStatBadge`, `ElevationChart`, `ContextCard`, `StationRow`, `StatusPill` (Tasks 16, 19, 20); `getSunInfo` (Task 10); `useFavoritesStore` (Task 14)
- Produces: functioning tracking screen at `/track/[trainNumber]`

- [ ] **Step 1: Write the page (server component wrapper for the dynamic route)**

Create `app/track/[trainNumber]/page.tsx`:
```tsx
import { TrackingScreen } from './TrackingScreen';

export default function TrackPage({ params }: { params: { trainNumber: string } }) {
  return <TrackingScreen trainNumber={params.trainNumber} />;
}
```

- [ ] **Step 2: Write the client component assembling map + sheet**

Create `app/track/[trainNumber]/TrackingScreen.tsx`:
```tsx
'use client';

import { useJourney } from '@/hooks/useJourney';
import { useRouteContext } from '@/hooks/useRouteContext';
import { useWeather } from '@/hooks/useWeather';
import { MapCanvas } from '@/components/Map/MapCanvas';
import { BottomSheet } from '@/components/BottomSheet/BottomSheet';
import { TripStatBadge } from '@/components/TripStatBadge';
import { ElevationChart } from '@/components/ElevationChart';
import { ContextCard } from '@/components/ContextCard';
import { StationRow } from '@/components/StationRow';
import { StatusPill } from '@/components/ui/StatusPill';
import { getSunInfo } from '@/lib/sun';

export function TrackingScreen({ trainNumber }: { trainNumber: string }) {
  const { data: journey, isLoading, error } = useJourney(trainNumber);

  const routeContext = useRouteContext(
    journey?.routeGeometry,
    journey?.totalDistanceKm ?? 0,
    trainNumber,
    !!journey
  );

  const weather = useWeather(
    journey?.currentLocation.lat,
    journey?.currentLocation.lng,
    !!journey
  );

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center">Loading train...</div>;
  }

  if (error || !journey) {
    return <div className="flex min-h-screen items-center justify-center">Couldn&apos;t load this train. Try again shortly.</div>;
  }

  const sun = getSunInfo(journey.currentLocation.lat, journey.currentLocation.lng);

  return (
    <div className="relative min-h-screen">
      <MapCanvas journey={journey} />

      <BottomSheet
        peek={
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink-muted">{journey.number} · {journey.name}</p>
              <p className="text-2xl font-semibold tabular-nums">{journey.speedKmh} km/h</p>
            </div>
            <StatusPill status={journey.status} delayMinutes={journey.delayMinutes} />
          </div>
        }
        half={
          <div className="mt-3x flex flex-col gap-3x">
            {routeContext.data && routeContext.data.elevationProfile.length > 0 && (
              <ElevationChart points={routeContext.data.elevationProfile} />
            )}
            <div className="grid grid-cols-3 gap-1x">
              <TripStatBadge label="Complete" value={`${Math.round(journey.completionPercentage)}%`} />
              <TripStatBadge label="Remaining" value={`${Math.round(journey.remainingDistanceKm)} km`} />
              <TripStatBadge label="ETA" value={journey.ETA} />
            </div>
            <div>
              {journey.nextStation && <StationRow station={journey.nextStation} />}
            </div>
          </div>
        }
        full={
          <div className="mt-3x flex flex-col gap-3x">
            <div className="flex flex-wrap gap-1x">
              {weather.data && <ContextCard variant="weather" weather={weather.data} />}
              <ContextCard variant="sun" sun={sun} />
              {routeContext.data?.terrainFeatures.slice(0, 4).map((f) => (
                <ContextCard key={`${f.type}-${f.name}`} variant="terrain" feature={f} />
              ))}
            </div>
            <div>
              {journey.stations.map((s) => (
                <StationRow key={s.code} station={s} />
              ))}
            </div>
          </div>
        }
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, navigate to `http://localhost:3000/track/12951` in a browser.
Expected: map loads, bottom sheet appears in peek state at the bottom, drag gesture moves it through half/full states, weather/terrain cards appear in full state.

- [ ] **Step 5: Commit**

```bash
git add app/track/
git commit -m "feat: add tracking screen assembling map, bottom sheet, and context cards"
```

---

## Task 23: Favorites Page

**Files:**
- Create: `app/favorites/page.tsx`
- Modify: `components/SearchBar.tsx` (add favorite-toggle button per result)

**Interfaces:**
- Consumes: `useFavoritesStore` (Task 14)
- Produces: functioning favorites screen at `/favorites`

- [ ] **Step 1: Write the Favorites page**

Create `app/favorites/page.tsx`:
```tsx
'use client';

import Link from 'next/link';
import { useFavoritesStore } from '@/store/useFavoritesStore';

export default function FavoritesPage() {
  const { favorites, removeFavorite } = useFavoritesStore();

  if (favorites.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-2x px-3x text-center">
        <p className="text-lg font-medium">No favorites yet</p>
        <p className="text-sm text-ink-muted">Search for a train and tap the star to save it here.</p>
        <Link href="/" className="text-accent underline">Back to search</Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col gap-2x px-3x py-4x">
      <h1 className="text-xl font-semibold">Favorites</h1>
      <ul className="flex flex-col gap-1x">
        {favorites.map((train) => (
          <li key={train.number} className="glass flex items-center justify-between rounded-card px-2x py-1x">
            <Link href={`/track/${train.number}`} className="flex flex-col">
              <span className="text-sm font-semibold">{train.number} · {train.name}</span>
              <span className="text-xs text-ink-muted">{train.from} → {train.to}</span>
            </Link>
            <button onClick={() => removeFavorite(train.number)} className="text-xs text-status-heavyDelay">
              Remove
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Add favorite-toggle to SearchBar results**

Modify `components/SearchBar.tsx` — add the import and a star button inside each result `<li>`:
```tsx
import { useFavoritesStore } from '@/store/useFavoritesStore';
```
Inside the `SearchBar` component body, add:
```tsx
const { addFavorite, isFavorite } = useFavoritesStore();
```
Change the result `<li>` block to:
```tsx
<li key={r.id} className="flex items-center justify-between">
  <button
    onClick={() => router.push(`/track/${r.number}`)}
    className="flex flex-1 flex-col items-start rounded-card px-1x py-1x text-left hover:bg-surface-raised"
  >
    <span className="text-sm font-semibold">{r.number} · {r.name}</span>
    {r.origin.name && r.destination.name && (
      <span className="text-xs text-ink-muted">{r.origin.name} → {r.destination.name}</span>
    )}
  </button>
  <button
    onClick={() =>
      addFavorite({
        number: r.number,
        name: r.name,
        from: r.origin.name,
        fromCode: r.origin.code,
        to: r.destination.name,
        toCode: r.destination.code,
      })
    }
    className="px-1x text-lg"
    aria-label="Add to favorites"
  >
    {isFavorite(r.number) ? '★' : '☆'}
  </button>
</li>
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/favorites/page.tsx components/SearchBar.tsx
git commit -m "feat: add favorites page and favorite-toggle in search results"
```

---

## Task 24: PWA — Manifest, Icons, Service Worker

**Files:**
- Create: `app/manifest.ts`
- Create: `scripts/generate-icons.mjs`
- Create: `public/icon-192.png`, `public/icon-512.png` (generated)
- Create: `public/sw.js`
- Create: `components/ServiceWorkerRegister.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: installable PWA manifest, app-shell-caching service worker

- [ ] **Step 1: Write a dependency-free PNG icon generator**

Create `scripts/generate-icons.mjs`:
```js
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function solidColorPng(size, [r, g, b]) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: RGB
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = chunk('IHDR', ihdrData);

  const rowBytes = size * 3 + 1;
  const raw = Buffer.alloc(rowBytes * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * rowBytes;
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 3;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }
  const idat = chunk('IDAT', deflateSync(raw));
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

const ACCENT = [10, 132, 255]; // matches --accent token

writeFileSync('public/icon-192.png', solidColorPng(192, ACCENT));
writeFileSync('public/icon-512.png', solidColorPng(512, ACCENT));
console.log('Generated public/icon-192.png and public/icon-512.png');
```

- [ ] **Step 2: Run the generator**

Run: `node scripts/generate-icons.mjs`
Expected: prints confirmation, `public/icon-192.png` and `public/icon-512.png` exist

Note: these are solid-color placeholder icons. Replace with a real designed app icon before shipping to production — flag this in `docs/ROADMAP.md` (Task 26).

- [ ] **Step 3: Write the manifest**

Create `app/manifest.ts`:
```ts
import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Train-Tracker',
    short_name: 'Train-Tracker',
    description: 'Live train tracking, beautifully.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0c',
    theme_color: '#0a84ff',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
```

- [ ] **Step 4: Write the service worker (app-shell caching only)**

Create `public/sw.js`:
```js
const CACHE_NAME = 'train-tracker-shell-v1';
const SHELL_ASSETS = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls — live train data must always be fresh or explicitly fail.
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request).catch(() => caches.match('/')))
  );
});
```

- [ ] **Step 5: Register the service worker client-side**

Create `components/ServiceWorkerRegister.tsx`:
```tsx
'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    }
  }, []);

  return null;
}
```

Modify `app/layout.tsx` to render it inside `<body>`:
```tsx
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
```
```tsx
<body>
  <QueryProvider>{children}</QueryProvider>
  <ServiceWorkerRegister />
</body>
```

- [ ] **Step 6: Verify build and manifest output**

Run: `npm run build && npm run start &`
Run: `curl -s http://localhost:3000/manifest.webmanifest | head -c 200`
Expected: valid JSON manifest content. Kill the server after.

- [ ] **Step 7: Commit**

```bash
git add app/manifest.ts scripts/generate-icons.mjs public/icon-192.png public/icon-512.png public/sw.js components/ServiceWorkerRegister.tsx app/layout.tsx
git commit -m "feat: add PWA manifest, app-shell service worker, and generated icons"
```

---

## Task 25: E2E Smoke Test

**Files:**
- Create: `e2e/tracking.spec.ts`

**Interfaces:**
- Consumes: the running app (all prior tasks)
- Produces: a Playwright smoke test covering search → track → bottom sheet drag

- [ ] **Step 1: Write the smoke test**

Create `e2e/tracking.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('search for a train and open its tracking screen', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Search train number or name').fill('12951');
  await page.waitForTimeout(400); // debounce window

  const firstResult = page.locator('li button').first();
  await expect(firstResult).toBeVisible({ timeout: 5000 });
  await firstResult.click();

  await expect(page).toHaveURL(/\/track\/\d+/);
});

test('bottom sheet drags through peek, half, and full snap states', async ({ page }) => {
  await page.goto('/track/12951');

  const sheet = page.locator('.glass.fixed.left-0.right-0.bottom-0');
  await expect(sheet).toBeVisible({ timeout: 10000 });

  const box = await sheet.boundingBox();
  if (!box) throw new Error('bottom sheet has no bounding box');

  // Drag the handle upward to move from peek toward full
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 400, { steps: 10 });
  await page.mouse.up();

  await page.waitForTimeout(500); // spring settle
  const newBox = await sheet.boundingBox();
  expect(newBox!.y).toBeLessThan(box.y);
});
```

- [ ] **Step 2: Run the E2E suite**

Run: `npm run test:e2e`
Expected: PASS (2 tests). If the RailRadar API key is invalid/unprovisioned, the app should still fall back to `generateFallbackJourney` (Task 6) so this test does not depend on live API availability.

- [ ] **Step 3: Commit**

```bash
git add e2e/
git commit -m "test: add E2E smoke test for search-to-track and bottom sheet drag"
```

---

## Task 26: Documentation Suite

**Files:**
- Create: `docs/PRD.md`
- Create: `docs/ARCHITECTURE.md`
- Create: `docs/DESIGN.md`
- Create: `docs/UX.md`
- Create: `docs/API.md`
- Create: `docs/DATA_MODELS.md`
- Create: `docs/COMPONENTS.md`
- Create: `docs/ROADMAP.md`

**Interfaces:**
- Consumes: the full implementation from Tasks 1–25
- Produces: the documentation suite specified in the design spec §11

- [ ] **Step 1: Write `docs/DATA_MODELS.md`**

Document every interface from `types/train.ts` and `types/geo.ts` (Task 3) verbatim as a reference, plus a one-line description of where each is produced/consumed (e.g. "`LiveJourney` — produced by `lib/railradar.ts:getLiveJourney`, consumed by `hooks/useJourney.ts`, `components/Map/MapCanvas.tsx`").

- [ ] **Step 2: Write `docs/API.md`**

Document each API route from Tasks 11–12: method, path, request body/query params, response shape, cache TTL, and error responses (404/429/502), matching the actual route implementations exactly.

- [ ] **Step 3: Write `docs/COMPONENTS.md`**

List every component from Tasks 16–23 (`Button`, `StatusPill`, `BottomSheet`, `MapCanvas`, `TrainMarker`, `TripStatBadge`, `ElevationChart`, `ContextCard`, `StationRow`, `SearchBar`) with props signature and one-line responsibility.

- [ ] **Step 4: Write `docs/DESIGN.md`**

Extract the token tables directly from `tailwind.config.ts` and `app/globals.css` (Task 13): color tokens (light/dark values), spacing scale, border radius, shadows, blur, motion curves (spring damping/stiffness from `BottomSheet.tsx`).

- [ ] **Step 5: Write `docs/UX.md`**

Document the 3 bottom sheet states (peek/half/full) with their height fractions (`SNAP_HEIGHTS` from Task 17), what content each reveals (per Task 22's `TrackingScreen`), and the fling/snap gesture rules (`resolveSnapState` logic).

- [ ] **Step 6: Write `docs/ARCHITECTURE.md`**

Diagram (as a text/mermaid description) the data flow: client hooks (Task 15) → API routes (Tasks 11–12) → Redis cache (Task 5) → external APIs (Tasks 6–10). Note the polling/visibility-pause behavior and the stale-data fallback strategy.

- [ ] **Step 7: Write `docs/PRD.md`**

Restate the MVP feature scope from the design spec §6, expanded with acceptance criteria per feature (e.g. "Live map: renders within 2s of navigating to `/track/[trainNumber]`; train marker updates position within 1s of a new poll response").

- [ ] **Step 8: Write `docs/ROADMAP.md`**

List Phase 2+ deferred features (Journey Timeline, Route Replay, Time Machine, Delay Prediction, Route Heatmap, Platform Intelligence, native app wrapper) per spec §6, plus known MVP follow-ups: replace placeholder PNG icons (Task 24) with a real designed icon set, provision a real Upstash Redis instance if not already done.

- [ ] **Step 9: Verify all doc files exist and are non-empty**

Run: `for f in docs/PRD.md docs/ARCHITECTURE.md docs/DESIGN.md docs/UX.md docs/API.md docs/DATA_MODELS.md docs/COMPONENTS.md docs/ROADMAP.md; do test -s "$f" && echo "OK: $f" || echo "MISSING/EMPTY: $f"; done`
Expected: all 8 files print `OK`

- [ ] **Step 10: Commit**

```bash
git add docs/PRD.md docs/ARCHITECTURE.md docs/DESIGN.md docs/UX.md docs/API.md docs/DATA_MODELS.md docs/COMPONENTS.md docs/ROADMAP.md
git commit -m "docs: add full documentation suite (PRD, architecture, design, UX, API, data models, components, roadmap)"
```

---

## Final Verification

- [ ] Run the full test suite: `npm test`
- [ ] Run typecheck: `npx tsc --noEmit`
- [ ] Run lint: `npm run lint`
- [ ] Run E2E: `npm run test:e2e`
- [ ] Run a production build: `npm run build`
- [ ] Manually verify in a browser at mobile viewport width (375px) and desktop width: search → track → drag bottom sheet through all 3 states → toggle a favorite → visit `/favorites`
