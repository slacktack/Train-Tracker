# Train Tracker

Live, real-time train tracking for Indian Railways — a nationwide map of every
train, tap any train for live status, and track its journey station-by-station.

## Features

- **Live national map** — every running train in India on a MapTiler basemap,
  theme-aware (light/dark), with speed-based markers
- **Tap any train** — live speed with acceleration/braking delta, next stop,
  ETA, delay, vacant berths (coach chart), photo, and full station timeline
- **Deep tracking page** — journey progress, elevation profile, terrain
  features, weather and sun conditions at the train's location, coach
  occupancy, runs-on schedule
- **Command palette (⌘K)** — jump straight to any train by number or name
- **Filters** — by train type (Vande Bharat, Rajdhani, Shatabdi…), motion
  (moving / at station), and speed
- **Auto light/dark theme** — follows IST day/night with manual override
- **Designed for mobile and desktop** — bottom sheet on mobile, side panel on
  desktop, touch-friendly throughout

## Stack

- Next.js 14 (App Router) + TypeScript
- MapLibre GL + MapTiler
- TanStack Query, Framer Motion
- Tailwind CSS with a custom design-token system
- Upstash Redis for API caching, Vitest + Playwright for tests

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev
```

Required env vars (see `.env.example`):

| Variable | Purpose |
|---|---|
| `RAILRADAR_API_KEY` | Live train feed + journey data |
| `NEXT_PUBLIC_MAPTILER_API_KEY` | Map basemaps |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Response caching |

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run start      # serve the production build
npm test           # unit tests (Vitest)
npm run test:e2e   # end-to-end (Playwright)
```

## Architecture

- `app/api/*` — server routes: active trains feed, journey, schedule, coach
  chart, weather, search, station lookup
- `lib/` — data layer: RailRadar client with high-priority request lane,
  Redis cache, elevation/terrain/weather enrichment, IST time helpers
- `components/` — map, train detail panel, bottom sheet, context cards,
  elevation chart, command palette
- `store/` — tracking store shared between map and panels

Live position data is enriched with elevation, weather, sun phase, terrain
features, and route geometry so each train card is a full context snapshot.
