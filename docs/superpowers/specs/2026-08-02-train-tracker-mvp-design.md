# Train-Tracker MVP — Design Spec

Date: 2026-08-02
Status: Approved for planning

## 1. Context & Goal

`Train-Tracker` is a from-scratch rebuild of the old `RailGaadi` prototype (which lives alongside
it at `../RailGaadi`). The old repo has a working but "class-less, low-budget" UI; its API
integration logic (RailRadar client, Overpass, Open-Topography, caching) is solid and reusable.

Goal: a world-class, glassy, Apple Maps / Flighty-grade live train tracking web app with full
mobile support, built as a focused MVP first — not the entire feature list from `initial-plan.md`
/ `revised-plan.md` in one shot. Later phases (Journey Timeline, Route Replay, Time Machine,
Delay Prediction, Route Heatmap, Platform Intelligence) are deferred — see `ROADMAP.md`.

## 2. Tech Stack

- **Framework:** Next.js 14 (App Router), TypeScript
- **Map:** MapLibre GL JS + MapTiler vector tiles (adaptive light/dark style)
- **State:** Zustand (client/UI state) + TanStack Query (server state, caching, retry)
- **Motion:** Framer Motion (spring-based bottom sheet + micro-interactions)
- **Styling:** Tailwind CSS + custom glass utilities
- **Backend:** Next.js API routes proxy all external APIs; Upstash Redis cache layer
- **Testing:** Vitest (unit) + Playwright (E2E smoke)
- **Deployment target:** Vercel
- **PWA:** installable manifest + service worker (app-shell caching only, no background sync)

Rationale: reuses working API-integration patterns from RailGaadi; avoids a stack rewrite
(Svelte) with no existing reference code in this codebase.

## 3. Code Reuse from RailGaadi

Port and upgrade (not copy verbatim):
- `lib/railradar.ts` — RailRadar client, response normalization, polyline interpolation,
  quota-exceeded handling, fallback journey generator (kept only as a last-resort
  no-data placeholder, never silently swapped in for a real trip with a real API failure)
- `lib/overpass.ts`, `lib/opentopography.ts` — geo/elevation data fetch patterns
- `lib/cache.ts` — caching wrapper, adapted to Redis-backed stale-while-revalidate

Rewrite from scratch: all UI, components, app structure, styling, design system.

## 4. Design System

- **Theme:** true adaptive — `prefers-color-scheme` driven, with a manual toggle. Light and
  dark themes get equal design effort (independent token sets, not a mechanical color invert).
- **Glassmorphism:** structural, not decorative — applied to the bottom sheet and floating
  cards/search bar via `backdrop-filter: blur()`, not on every surface. Map tiles matched to
  theme (MapTiler light/dark vector style).
- **Layout:** 8pt spacing grid, large rounded corners (16–24px), edge-to-edge full-viewport map,
  floating controls with safe-area-inset padding (notch/home-indicator aware).
- **Typography:** single type scale, strong hierarchy; tabular figures for live-updating numbers
  (speed, ETA, stats) so digits don't jitter on refresh.
- **Motion:** spring-based (Framer Motion) per Apple HIG timing; bottom sheet uses
  velocity-based snapping with rubber-banding between peek/half/full, not linear tweens.
- **Color:** neutral per-theme surface palette + a small semantic status set (on-time green,
  minor-delay amber, heavy-delay red), reused consistently across trip-progress bar, station
  list, and map route line.
- **Deliverable:** `docs/DESIGN.md` with full token tables (color, type scale, spacing, radius,
  shadow, blur, motion curves) — generated during planning so implementation doesn't invent
  tokens ad hoc.

## 5. Screens & Components

### Home / Search
Floating glass search bar over a map preview / recent & favorite trains list. Search by train
number or station pair. Tap a result to start tracking.

### Tracking screen (primary)
Full-viewport map, animated train marker, route polyline colored by status. Draggable bottom
sheet, 3 snap states:
- **Peek:** train number/name, live speed, status badge, ETA to next stop
- **Half:** + elevation profile graph, next 3 stations, trip stats (avg/top speed, % complete,
  remaining time)
- **Full:** + geo/weather context cards (river/mountain/tunnel crossed, weather along route,
  sunrise/golden hour), full station list with times/platform/delay

### Favorites
Saved trains, quick-resume tracking.

### Component inventory (`docs/COMPONENTS.md`)
`MapCanvas`, `TrainMarker`, `BottomSheet` (reusable gesture/snap primitive), `TripStatBadge`,
`ElevationChart`, `ContextCard` (variants: river/mountain/weather/tunnel), `StationRow`,
`SearchBar`, `StatusPill`.

## 6. MVP Feature Scope

In scope:
- Live map + Apple Maps-style bottom sheet
- Geographic & weather context cards (rivers/mountains/tunnels via Overpass, weather via
  Open-Meteo, sunrise/sunset/golden hour via `suncalc`)
- Elevation profile + beautiful trip stats
- Search & train selection, favorites
- PWA basics (installable, offline app shell)

Deferred to Phase 2+ (`docs/ROADMAP.md`):
- Journey Timeline (chronological event feed)
- Route Replay / Time Machine
- Delay Prediction Confidence Engine
- Route Heatmap
- Platform Intelligence
- Native app wrapper (Capacitor/Expo) — architecture should not preclude this later

## 7. Data Flow

- Client polls `/api/journey/[trainNumber]` every ~15–20s while the tracking screen is active;
  polling pauses when the tab is hidden (Page Visibility API) to conserve API quota.
- Route geometry and geo-context (rivers/tunnels/mountains) are fetched once per trip and cached
  — they don't change mid-journey.
- Weather refreshes every ~5–10 min.
- TanStack Query owns client-side caching/retry; Redis owns server-side caching shared across
  users (stale-while-revalidate: live status ~15–30s TTL, static geo/route data ~24h TTL).

## 8. Error Handling

- RailRadar quota-exceeded or network failure → fall back to last-known-good cached state with a
  subtle "reconnecting" indicator. Never show a blank/broken screen. The old repo's
  `generateFallbackJourney` pattern is retained only as a genuine no-data placeholder (e.g. a
  train number with zero data available anywhere), never silently substituted for a real trip
  experiencing a transient API failure.
- Geo/weather/elevation failures degrade gracefully — the relevant context card simply doesn't
  render, rather than showing an error state.

## 9. PWA

Installable manifest + icons; service worker caches the app shell and static assets only (not
live train data), so the app opens instantly offline into an explicit "no connection" state
rather than a white screen. No background sync or push notifications in MVP.

## 10. Testing

- **Vitest:** unit tests for pure-function logic — API response normalization, polyline
  interpolation, geo/elevation utilities. These carry real edge cases and are worth covering.
- **Playwright:** a small E2E smoke suite (search → track a train → bottom sheet drag through
  all three snap states), not exhaustive coverage. MVP priority is a fast path to a polished,
  working experience.

## 11. Documentation Suite (generated as part of this planning phase)

```
docs/
├── PRD.md
├── ARCHITECTURE.md
├── DESIGN.md
├── UX.md              # bottom sheet states, gesture physics, micro-interactions
├── API.md             # RailRadar, Overpass, Open-Meteo, Open-Elevation contracts
├── DATA_MODELS.md     # TypeScript interfaces
├── COMPONENTS.md
└── ROADMAP.md          # MVP -> Phase 2 -> Phase 3
```

## 12. Prerequisites

- API keys: see `links.md` at the project root. RailRadar and MapTiler are required before the
  live-data path can be tested; Open-Meteo, Open-Elevation, and Overpass need no signup.
- Upstash Redis instance for the cache layer.

## 13. Out of Scope (explicitly)

- Native iOS/Android app builds (architecture keeps this open for later, not built now)
- Journey Timeline, Route Replay, Time Machine, Delay Prediction, Route Heatmap, Platform
  Intelligence — all Phase 2+
- Push notifications / background sync
- PNR tracking, ticket booking, or any transactional features
