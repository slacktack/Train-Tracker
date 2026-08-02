# Train Tracker — UI/UX Overhaul

Date: 2026-08-02

## Goal

The app already has a considered visual system (glass-morphism, IST-based day/night theme,
Geist + Space Grotesk fonts, spacing/radius tokens) and solid data infrastructure (React
Query, real rail-track geometry via Overpass with straight-line fallback). It is not usable
enough on mobile: text truncates/crowds on small screens, the type scale is applied
inconsistently, colors are muted, and it's unclear whether real rail paths are actually
rendering or silently falling back to straight lines.

Target user: mobile-first, must be usable by a non-technical person with zero onboarding
("my dad"). Primary complaint driving this work: truncation and cramped layout on mobile.

## Non-goals

- No new features (no notifications backend, no new data sources beyond what's already wired).
- No framework/library changes (stays Next.js 14 + Tailwind + Framer Motion + MapLibre).
- No rewrite of the data layer — React Query caching strategy is already sound.
- Desktop layout is secondary; fix only what breaks as a side effect of the shared components
  (most desktop layout already reads fine per the source).

## 1. Design tokens (`tailwind.config.ts`, `app/globals.css`)

**Accent color:** replace the current iOS-blue accent (`#0A84FF` light / `#409CFF` dark) with
a more saturated indigo/electric-blue, tuned per-theme so contrast against glass surfaces
holds up (target ≥ 4.5:1 against `--ink` text use, and clearly visible against
`--surface-raised` at the glass opacities already in use):
- light: `--accent: 79 70 229` (`#4F46E5`-ish, tuned during implementation)
- dark: a brighter tint of the same hue for legibility on dark glass

**Status colors:** bump saturation/vibrancy of `status.onTime` / `status.minorDelay` /
`status.heavyDelay` so delay state is legible at a glance (this is the primary signal a
non-technical user reads). Keep the same three-state semantics.

**Type scale:** introduce named text roles instead of ad hoc sizes (`text-[10px]`,
`text-[11px]` scattered through components today). Roles, mapped to existing Tailwind sizes:
- `label` (uppercase eyebrow text, e.g. "STATIONS · 12"): 11px, semibold, tracked
- `caption` (secondary/meta text, e.g. "At station"): 12px
- `body` (default row/paragraph text): 14px
- `subhead` (card titles, e.g. train name): 16–18px, semibold
- `headline` (hero numbers — speed, countdown): Space Grotesk, 24–32px
- `stat` (badge values in `TripStatBadge`): Space Grotesk, 16–18px tabular-nums

Every component gets migrated onto these roles instead of one-off `text-[Npx]` values, so
size/weight is consistent across the whole app. Spacing tokens (`1x`…`6x`) and radii
(`card`/`sheet`/`pill`) stay as-is — they're already coherent.

## 2. Per-screen mobile-layout fixes

Verified by loading the running dev server (port 3000) in Chrome at 360px, 390px, and 428px
widths, screenshotting each state, and fixing what's actually observed — not guessed.

- **Home header** (`app/page.tsx`): search bar + live-count pill + theme toggle at narrow
  widths. Confirm nothing overlaps/clips below ~375px; simplify what's shown (e.g. drop the
  "live" label sooner) if it does.
- **`TrainDetailCard`**: coach-occupancy chips and the header block generally already guard
  with `break-words`/`min-w-0`; verify at 360px, tighten padding/line-height where cramped.
- **`TrackingScreen` `RunsOnBadge`** day-of-week pills: verify `flex-wrap` doesn't produce an
  orphaned single pill on its own crowded line at narrow widths.
- **Bottom sheet peek state** (`TrackingScreen.tsx`): highest-risk truncation area — train
  number/name, status pill, delay, ETA, next-stop all compete for a 3-col grid at minimum
  sheet height. Fix: prioritize the most important 2 stats at `peek`, defer the rest to `half`,
  or stack instead of a 3-col grid below a width threshold.
- **`ContextCard`** (`auto-fit minmax(8.5rem,1fr)`) and **`TripStatBadge`** grids: check for
  lopsided/orphaned cells at odd widths (e.g. 2 items in a 3-col grid); adjust `minmax` or
  add explicit column counts per breakpoint if needed.
- **`StationBoard`**, **`MapFilterBar`**, **`CommandPalette`**: already use `truncate`/
  `line-clamp` sensibly — verify visually, fix only if something is found broken.

Fix pattern going forward: consistent use of `min-w-0` + `truncate`/`line-clamp-N` (never bare
`overflow-hidden` without a `min-w-0` ancestor), no fixed pixel widths on text containers,
responsive stacking (`flex-col sm:flex-row`) preferred over shrinking font size to fit.

## 3. Real rail-track paths

`lib/rail-route.ts` already implements the real thing: fetches `railway=rail` ways from
Overpass per station-to-station leg, builds a graph, and Dijkstras the shortest path along
actual track, with a straight-line fallback per-leg when Overpass/the rail graph is
unavailable. `MapCanvas.tsx` renders `journey.routeGeometry` when present.

Work here is **debugging, not building**:
1. Confirm via live testing whether `getRailRouteGeometry` is actually returning rail-snapped
   geometry for real trains today, or silently falling back to straight legs (check
   `usedRail`, Overpass response success rate, `SNAP_DIST_KM` = 25km may be too strict or too
   loose for some corridors).
2. Fix whatever's causing fallback (Overpass timeouts, bbox too small/large, snap distance,
   station coordinate quality) — no redesign of the algorithm unless it's fundamentally broken.
3. Check whether the home page `LiveMap` renders per-train paths at all today; if the pattern
   is directly reusable, wire it in the same way the tracking page does. If home-map paths
   are architecturally a bigger lift (e.g. one path per visible train, perf concerns with many
   trains on screen), scope that down or flag it rather than forcing it in.

## 4. Perceived performance

No data-layer changes. Audit every async panel (coach chart, weather, elevation, photo) for a
proper skeleton/shimmer state instead of a pop-in/blank gap, consistent with the loading
states `TrainDetailCard` already uses in its "isLoading" branch.

## 5. Verification

Using the Chrome extension against the already-running dev server on port 3000:
- Screenshot home (map + header + filters), train detail card, station board, command palette,
  and tracking page (desktop aside layout + mobile bottom sheet at peek/half/full) at 360px,
  390px, 428px, and one desktop width.
- Confirm no visible truncation/overlap/orphaned-grid-cell issues remain at each checkpoint.
- Confirm rail-track paths render as real (non-straight) geometry for at least one live train
  with a multi-station route, or document why they don't for that specific case.
