# Train Tracker UI/UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix mobile truncation/crowding, unify the typography scale, punch up the accent/status colors, verify (and fix) real rail-track path rendering, and audit loading states — across the whole app — without changing the underlying data layer or architecture.

**Architecture:** Design-token changes in `tailwind.config.ts` / `app/globals.css` ripple through every component via existing utility classes. Per-screen fixes are localized JSX/className edits. The rail-path work is a debugging pass on the existing `lib/rail-route.ts` Overpass pipeline, plus a scoped addition to draw the selected train's route on the home map by reusing the `useJourney` hook (React Query dedupes the fetch — `TrainDetailCard` already calls `useJourney(train.n)` for the same train).

**Tech Stack:** Next.js 14, React 18, Tailwind CSS 3, Framer Motion, MapLibre GL, TanStack Query 5, Vitest, Playwright.

## Global Constraints

- No new dependencies, no data-layer/architecture rewrites (spec non-goals).
- Accent color direction: vibrant single indigo/electric-blue accent (user-approved), not per-train-type coloring or multi-tone gradients.
- Every text container fix must use `min-w-0` + `truncate`/`line-clamp-N`, never bare `overflow-hidden` without a `min-w-0` ancestor; prefer responsive stacking (`flex-col sm:flex-row`) over shrinking font size to fit.
- Verify visually against the running dev server on port 3000 using the Chrome extension at 360px, 390px, 428px, and one desktop width for every screen touched.
- Run `npm test` (Vitest) after any change to a file with an existing `*.test.ts`/`*.test.tsx`, and keep it passing.

---

### Task 1: Design tokens — accent color, status colors, typography scale

**Files:**
- Modify: `app/globals.css:5-23` (`:root` and `.dark` custom properties)
- Modify: `tailwind.config.ts:12-49` (`colors.status`, add `fontSize` scale)

**Interfaces:**
- Produces: CSS custom properties `--accent` (light: `10 132 255` → new value; dark: `409 156 255` → new value), `status.onTime`/`minorDelay`/`heavyDelay` hex values, and Tailwind `fontSize` keys `label`, `caption`, `body`, `subhead`, `headline`, `stat` — consumed by every later task.

- [ ] **Step 1: Update accent color custom properties**

In `app/globals.css`, change:
```css
:root {
  ...
  --accent: 10 132 255;
  ...
}
.dark {
  ...
  --accent: 64 156 255;
  ...
}
```
to:
```css
:root {
  ...
  --accent: 79 70 229; /* indigo-600, vibrant against light glass */
  ...
}
.dark {
  ...
  --accent: 129 140 255; /* brighter indigo tint for legibility on dark glass */
  ...
}
```

- [ ] **Step 2: Boost status color saturation**

In `tailwind.config.ts`, change:
```ts
status: {
  onTime: '#34C759',
  minorDelay: '#FF9F0A',
  heavyDelay: '#FF3B30',
},
```
to:
```ts
status: {
  onTime: '#22C55E',
  minorDelay: '#F59E0B',
  heavyDelay: '#EF4444',
},
```

- [ ] **Step 3: Add named typography scale to Tailwind config**

In `tailwind.config.ts`, inside `theme.extend`, add:
```ts
fontSize: {
  label: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.03em', fontWeight: '600' }],
  caption: ['0.75rem', { lineHeight: '1rem' }],
  body: ['0.875rem', { lineHeight: '1.25rem' }],
  subhead: ['1.0625rem', { lineHeight: '1.375rem', fontWeight: '600' }],
  headline: ['1.75rem', { lineHeight: '2rem', fontWeight: '600' }],
  stat: ['1.0625rem', { lineHeight: '1.25rem', fontWeight: '600' }],
},
```

- [ ] **Step 4: Visual verification — no unit test exists for raw CSS tokens**

Run `npm run dev` if not already running (it's already running on port 3000 per the user). Load `http://localhost:3000` in Chrome, confirm:
- The search bar border/focus ring, live-count pill, and status pills now render in the new indigo accent, not the old iOS blue.
- Status pills (on time / delayed) show clearly more saturated green/orange/red.
- No layout shift or broken contrast in light or dark theme (toggle via `ThemeToggle`).

- [ ] **Step 5: Run existing test suite to confirm nothing broke**

Run: `npm test`
Expected: all existing tests (`StatusPill.test.ts`, `snapPhysics.test.ts`, `ElevationChart.test.ts`, `mapStyle.test.ts`) still PASS — none assert on exact color values, so this should be a no-op confirmation.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css tailwind.config.ts
git commit -m "style: vibrant indigo accent, saturated status colors, typography scale tokens"
```

---

### Task 2: Home header + MapFilterBar — typography and mobile fixes

**Files:**
- Modify: `app/page.tsx:147-203`
- Modify: `components/Home/MapFilterBar.tsx`

**Interfaces:**
- Consumes: Tailwind `fontSize` roles from Task 1 (`text-label`, `text-caption`, `text-body`, `text-subhead`).

- [ ] **Step 1: Apply typography roles to the header**

In `app/page.tsx`, replace ad hoc sizes in the header block (lines 147-203) with the new roles:
- `text-[10px] uppercase tracking-wider text-ink-muted` → `text-label text-ink-muted`
- `text-sm font-semibold leading-none` (brand name) → `text-subhead leading-none`
- `text-sm` search placeholder text → `text-body`
- `text-[10px]` on the `⌘K` kbd and the "live" pill → `text-label`

Do this for every occurrence in the file's header section (brand block, search bar, clock block, live-count pill).

- [ ] **Step 2: Apply typography roles to MapFilterBar**

In `components/Home/MapFilterBar.tsx`, the `chipBase` constant uses `text-xs font-medium` — leave chip label text as `text-caption font-medium` (closest match), and the `text-[10px] opacity-70` count badges become `text-label opacity-70` (drop the extra uppercase/letter-spacing visually by keeping `normal-case tracking-normal` since these are numbers, not labels — add those two utility classes alongside `text-label`).

- [ ] **Step 3: Visual verification at mobile widths**

Using the Chrome extension, resize/emulate to 360px, 390px, 428px widths, load `http://localhost:3000`, and confirm:
- Brand name, search bar, clock, live-count pill, and theme toggle in the header do not overlap or get cut off at 360px (the narrowest common Android width). If they do, the fix is to hide the brand-name text block earlier (already `hidden sm:block` — lower the breakpoint or hide unconditionally on the smallest widths) or reduce the search bar's `flex-1` competing space.
- The two rows of filter chips in `MapFilterBar` scroll horizontally without clipping the last chip, and no chip's count badge wraps onto a second line.
- Screenshot each width for the record.

- [ ] **Step 4: Fix any truncation found in Step 3**

Apply the specific fix identified (e.g. adjust `hidden sm:block` breakpoints, reduce `gap-2x` to `gap-1x` on the header flex row at the smallest breakpoint, or add `overflow-x-hidden` guards) directly in `app/page.tsx` / `MapFilterBar.tsx`. Re-run Step 3's screenshot check until clean.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx components/Home/MapFilterBar.tsx
git commit -m "style: apply typography scale and fix mobile header/filter truncation"
```

---

### Task 3: TrainDetailCard — typography and mobile fixes

**Files:**
- Modify: `components/Home/TrainDetailCard.tsx`

**Interfaces:**
- Consumes: Tailwind `fontSize` roles from Task 1.

- [ ] **Step 1: Apply typography roles**

Replace in `components/Home/TrainDetailCard.tsx`:
- Line 109 `text-xs font-semibold tracking-wide` (train number/type eyebrow) → `text-label`
- Line 113 `text-lg font-semibold leading-snug` (train name) → `text-subhead`
- Line 117 `text-xs text-ink-muted` (unicode name) → `text-caption`
- Line 167 `text-2xl font-semibold tabular-nums` (speed) → `text-headline tabular-nums`
- Lines 154, 198, 250 etc. `text-xs` meta text → `text-caption`

- [ ] **Step 2: Visual verification at mobile widths**

Select a train on the home map at 360px width in Chrome, open its `TrainDetailCard`, and confirm:
- The coach-occupancy chip (line 195-207) wraps its text cleanly, no clipped words.
- The speed/status row (lines 145-193) doesn't force the status pill or speed value onto an overlapping line.
- The origin/destination progress-bar labels (lines 272-283) don't collide with the centered percentage at narrow widths.
- Screenshot the card fully expanded and while loading (`isLoading` skeleton state, lines 211-229).

- [ ] **Step 3: Fix any truncation found in Step 2**

Apply the specific fix (e.g. reduce gap, stack the origin/destination row `flex-col` below 340px content width if the percentage collides, tighten `px-2x`/`py-1x` paddings) directly in the file. Re-check.

- [ ] **Step 4: Commit**

```bash
git add components/Home/TrainDetailCard.tsx
git commit -m "style: apply typography scale and fix mobile truncation in TrainDetailCard"
```

---

### Task 4: StationBoard + StationRow — typography and mobile fixes

**Files:**
- Modify: `components/Home/StationBoard.tsx`
- Modify: `components/StationRow.tsx`

**Interfaces:**
- Consumes: Tailwind `fontSize` roles from Task 1.

- [ ] **Step 1: Apply typography roles**

In `components/Home/StationBoard.tsx`: line 26 `text-xs font-semibold tracking-wide` → `text-label`; line 30 `text-lg font-semibold` → `text-subhead`; line 60 `text-sm font-semibold` → `text-body font-semibold`; line 63 `text-[11px]` → `text-caption`.

In `components/StationRow.tsx`: line 39 `text-sm font-medium` → `text-body font-medium`; line 45 `text-xs` → `text-caption`; line 49 `text-sm tabular-nums` → `text-body tabular-nums`; line 51 `text-xs` → `text-caption`.

- [ ] **Step 2: Visual verification at mobile widths**

At 360px, tap a station cluster on the home map to open `StationBoard`, confirm the train list rows (`t.n · t.name`, line 60-62) truncate with an ellipsis rather than wrapping/overflowing, and the secondary line (line 63-67, which can have up to 3 concatenated segments: running status, speed, "near X") truncates cleanly too. Screenshot.

- [ ] **Step 3: Fix any truncation found in Step 2**

If the secondary line's three segments make it unreadable when truncated on a narrow screen, drop the lowest-priority segment (`near X`) below a width threshold instead of relying purely on `truncate`. Apply directly.

- [ ] **Step 4: Commit**

```bash
git add components/Home/StationBoard.tsx components/StationRow.tsx
git commit -m "style: apply typography scale and fix mobile truncation in StationBoard"
```

---

### Task 5: CommandPalette — typography fixes

**Files:**
- Modify: `components/CommandPalette.tsx`

**Interfaces:**
- Consumes: Tailwind `fontSize` roles from Task 1.

- [ ] **Step 1: Apply typography roles**

Replace: line 134 `text-sm` (input) → `text-body`; line 137 `text-[10px]` (ESC kbd) → `text-label normal-case tracking-normal`; line 143/145/146 `text-xs` → `text-caption`; line 159 `text-xs font-semibold` (train number chip) → `text-caption font-semibold`; line 163 `text-sm` (result name) → `text-body`; line 165 `text-xs` (route) → `text-caption`; line 175-178 `text-[10px]` (footer hints) → `text-label normal-case tracking-normal`.

- [ ] **Step 2: Visual verification at mobile widths**

Open the command palette (⌘K or the search bar tap) at 360px, type a query, confirm result rows truncate cleanly and the footer hint row (`↑↓ navigate` / `↵ open` / `⌘K anywhere`) doesn't wrap or overflow. Screenshot.

- [ ] **Step 3: Fix any issue found in Step 2**

If the footer hints overflow at 360px, hide the least essential hint (`⌘K anywhere`) below `sm:` breakpoint. Apply directly.

- [ ] **Step 4: Commit**

```bash
git add components/CommandPalette.tsx
git commit -m "style: apply typography scale and verify CommandPalette on mobile"
```

---

### Task 6: TrackingScreen main panel — typography and mobile fixes

**Files:**
- Modify: `app/track/[trainNumber]/TrackingScreen.tsx:75-454` (`RunsOnBadge`, `CoachOccupancy`, `PreJourneyDashboard`, `panelBody`)

**Interfaces:**
- Consumes: Tailwind `fontSize` roles from Task 1.

- [ ] **Step 1: Apply typography roles**

Replace: line 80 `text-xs font-medium` → `text-caption font-medium`; lines 86/88 `text-[11px]` → `text-label normal-case tracking-normal`; line 103 `text-xs font-semibold uppercase tracking-wide` → `text-label`; line 106 `text-xs tabular-nums` → `text-caption tabular-nums`; line 117 `text-xs font-semibold tabular-nums` → `text-caption font-semibold`; line 149 `text-xs font-semibold uppercase tracking-wide` → `text-label`; line 153 `text-3xl font-bold tabular-nums tracking-tight` (countdown) → `text-headline tracking-tight`; line 156/158 `text-sm` → `text-body`; lines 262-293 (train name block) → apply the same `text-label`/`text-subhead`/`text-caption` mapping as Task 3's TrainDetailCard header; line 315/319 `text-sm font-semibold` → `text-body font-semibold`; line 386 `text-xs` → `text-caption`; line 388 `text-3xl font-semibold` (speed) → `text-headline`; line 433 `text-xs font-semibold uppercase tracking-wide` → `text-label`.

- [ ] **Step 2: Fix RunsOnBadge wrap risk**

In `RunsOnBadge` (lines 75-95), the 7 day pills plus the "Runs on" label share one `flex-wrap` row. At 360px this can orphan 1-2 pills onto their own line looking broken. Change the label to a `block` element above the pills row instead of sharing the flex row:
```tsx
function RunsOnBadge({ runsOn }: { runsOn: string[] }) {
  if (runsOn.length === 0) return null;
  const set = new Set(runsOn);
  return (
    <div className="flex flex-col gap-0.5x">
      <span className="text-label text-ink-muted">Runs on</span>
      <div className="flex flex-wrap items-center gap-1x">
        {DAY_ORDER.map((d) => (
          <span
            key={d}
            className={
              set.has(d)
                ? 'rounded-md bg-accent/15 px-1x py-0.5x text-caption font-semibold text-accent'
                : 'rounded-md px-1x py-0.5x text-caption text-ink-muted/50'
            }
          >
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Visual verification at mobile widths**

Load `http://localhost:3000/track/<a-real-train-number>` (grab a live train number from the home page's active list) at 360px in Chrome, both in the desktop-aside layout (won't show on mobile — `lg:flex`) and confirm the `panelBody` content inside the bottom sheet's `half` state: hero image caption block, `RunsOnBadge`, `PreJourneyDashboard` (if the train hasn't departed), origin→destination row, current/next station rows, speed block, and `TripStatBadge` grid. Screenshot at 360px, 390px, 428px.

- [ ] **Step 4: Fix any truncation found in Step 3**

Apply the specific fix directly in the file (same patterns as prior tasks: stack instead of shrink, prioritize instead of cram).

- [ ] **Step 5: Commit**

```bash
git add app/track/[trainNumber]/TrackingScreen.tsx
git commit -m "style: apply typography scale, fix RunsOnBadge wrap, verify tracking panel on mobile"
```

---

### Task 7: Bottom sheet peek state — stop cramming 5 data points into one row

**Files:**
- Modify: `app/track/[trainNumber]/TrackingScreen.tsx:503-562` (`BottomSheet` `peek` prop)

**Interfaces:**
- Consumes: `peekStatus`, `journey`, `projected`, `countdown` — already computed earlier in the component (lines 230-238).

This is the highest-risk truncation area identified in the spec: train number/name, status pill, delay, ETA, next-stop, origin/destination codes, and a progress bar all compete for space at the sheet's minimum height.

- [ ] **Step 1: Reduce the peek grid from 3 columns to 2, dropping "Next stop" from peek**

Replace the `grid-cols-3` block (lines 530-544):
```tsx
<div className="grid grid-cols-3 gap-1x">
  <TripStatBadge
    label="Delay"
    value={journey.delayMinutes > 0 ? `+${journey.delayMinutes}m` : 'On time'}
  />
  <TripStatBadge label="ETA" value={journey.ETA} />
  <TripStatBadge
    label="Next stop"
    value={
      journey.nextStation
        ? `${journey.nextStation.code} · ${journey.nextStation.scheduledArrival}`
        : '—'
    }
  />
</div>
```
with:
```tsx
<div className="grid grid-cols-2 gap-1x">
  <TripStatBadge
    label="Delay"
    value={journey.delayMinutes > 0 ? `+${journey.delayMinutes}m` : 'On time'}
  />
  <TripStatBadge label="ETA" value={journey.ETA} />
</div>
```
"Next stop" is already fully covered in the `half`/`full` sheet states via the `panelBody`'s next-station row (lines 351-363), so peek doesn't lose information — it's promoted, not dropped.

- [ ] **Step 2: Visual verification**

Open a tracking page at 360px in Chrome, confirm the bottom sheet's collapsed `peek` state (drag it to its lowest snap point, or reload — `sheetState` starts at `'peek'` per `useTrackingStore`) shows the train name/number line, status pill + countdown, the 2-stat grid, and the origin/destination progress row without any text clipping or 2-line overflow pushing the sheet taller than intended. Screenshot.

- [ ] **Step 3: Fix any remaining overflow found in Step 2**

If the train name line (`journey.number · journey.name`, line 508) still clips awkwardly on very long train names, confirm `break-words`/`truncate` is applied correctly — it currently uses `break-words` (line 508) which is correct for wrapping; if it wraps to 2 lines and looks cramped against the status pill, add `line-clamp-1 truncate` instead so long names get one clean ellipsis line at peek height specifically (not in `half`/`full`, where there's room).

- [ ] **Step 4: Commit**

```bash
git add app/track/[trainNumber]/TrackingScreen.tsx
git commit -m "fix: reduce bottom-sheet peek stat grid from 3 to 2 columns to stop cramming"
```

---

### Task 8: ContextCard + TripStatBadge — grid and typography fixes

**Files:**
- Modify: `components/ContextCard.tsx`
- Modify: `components/TripStatBadge.tsx`
- Modify: `app/track/[trainNumber]/TrackingScreen.tsx:420-430,446-452` (the two grid wrappers)

**Interfaces:**
- Consumes: Tailwind `fontSize` roles from Task 1.

- [ ] **Step 1: Apply typography roles**

In `components/TripStatBadge.tsx`, replace `text-xs` (label) → `text-label normal-case tracking-normal` and `text-base font-semibold tabular-nums sm:text-lg` (value) → `text-stat sm:text-lg`.

In `components/ContextCard.tsx`, replace every `text-xs text-ink-muted` → `text-caption text-ink-muted`, `text-base font-semibold leading-snug` (terrain name) → `text-subhead`, `text-2xl font-semibold tabular-nums` (temp) → `text-headline`, `text-sm` (sun times) → `text-body`.

- [ ] **Step 2: Fix odd-count grid lopsidedness**

Both grids use `grid-cols-[repeat(auto-fit,minmax(Nrem,1fr))]`, which can leave a lone last item stretched full-width when the count is odd relative to the row capacity at a given width. Change both in `TrackingScreen.tsx` to an explicit responsive column count instead of `auto-fit`:
- Line 420 (`TripStatBadge` grid, 6 items): `grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))]` → `grid-cols-2 sm:grid-cols-3`
- Line 446 (`ContextCard` grid, 2-6 items): `grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))]` → `grid-cols-2 sm:grid-cols-3`

- [ ] **Step 3: Visual verification**

At 360px, load a tracking page whose train has weather + terrain features populated (or one without, to check the fallback), confirm both grids render evenly (no stretched lone card, no cramped 3-up on a 360px screen) and text inside each card doesn't clip. Screenshot.

- [ ] **Step 4: Fix any issue found in Step 3**

Adjust the column count (e.g. `grid-cols-1 sm:grid-cols-2` for `ContextCard` if 2-up is still too tight at 360px for weather's 3-line content) directly in the file.

- [ ] **Step 5: Commit**

```bash
git add components/ContextCard.tsx components/TripStatBadge.tsx app/track/[trainNumber]/TrackingScreen.tsx
git commit -m "style: apply typography scale and fix grid lopsidedness in stat/context cards"
```

---

### Task 9: StationTimeline — typography check

**Files:**
- Modify: `components/StationTimeline.tsx`

**Interfaces:**
- Consumes: Tailwind `fontSize` roles from Task 1.

- [ ] **Step 1: Apply typography roles**

Replace: line 46 `text-sm font-medium` → `text-body font-medium`; line 52 `text-xs` → `text-caption`; line 59 `text-sm` → `text-body`; line 66 `text-xs` → `text-caption`; line 77 `text-xs font-semibold` (expand button) → `text-caption font-semibold`.

- [ ] **Step 2: Visual verification**

At 360px, scroll to the station timeline in a tracking page's `half`/`full` sheet, confirm station name / platform / arrival time / delay don't clip when a station name is long (e.g. "Chhatrapati Shivaji Maharaj Terminus"). Screenshot.

- [ ] **Step 3: Fix any issue found in Step 2**

If a long station name pushes the arrival-time column awkwardly, confirm `min-w-0`/`break-words` (already present, line 43/46) is sufficient — if the row still looks bad, reduce the time column's `shrink-0` width pressure by allowing it to wrap onto a second line under the name instead of staying side-by-side below 340px content width.

- [ ] **Step 4: Commit**

```bash
git add components/StationTimeline.tsx
git commit -m "style: apply typography scale to StationTimeline, verify long station names on mobile"
```

---

### Task 10: Rail-track path — debug why real geometry might be falling back to straight lines

**Files:**
- Modify: `lib/rail-route.ts:185-269` (`getRailRouteGeometry`)
- Test: `lib/rail-route.test.ts` (new)

**Interfaces:**
- Consumes: `fetchOverpassJson` from `lib/overpass-client.ts` (existing), `getCached`/`setCached` from `lib/redis-cache.ts` (existing).
- Produces: same signature as today — `getRailRouteGeometry(trainNumber: string, stations: Array<{lat:number; lng:number}>): Promise<[number,number][] | null>` — plus a new exported `RAIL_ROUTE_DEBUG` flag/log so live behavior can be inspected without changing the return contract.

- [ ] **Step 1: Write a failing test for the currently-untested `sampleStations` helper**

This function has no test coverage and is easy to get subtly wrong (it silently changes which station pairs get queried). Create `lib/rail-route.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { snapPointToPolyline } from './rail-route';

describe('snapPointToPolyline', () => {
  it('snaps a point onto the nearest segment of a polyline', () => {
    const coords: [number, number][] = [
      [77.0, 12.0],
      [77.1, 12.0],
      [77.2, 12.0],
    ];
    const result = snapPointToPolyline(12.0, 77.05, coords);
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(12.0, 5);
    expect(result!.lng).toBeCloseTo(77.05, 2);
    expect(result!.distanceKm).toBeLessThan(1);
  });

  it('returns null for a polyline with fewer than 2 points', () => {
    expect(snapPointToPolyline(12.0, 77.0, [[77.0, 12.0]])).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to confirm it passes against existing code**

Run: `npx vitest run lib/rail-route.test.ts`
Expected: PASS — `snapPointToPolyline` is already correctly implemented; this test just locks in the existing contract before the debugging pass below touches the same file.

- [ ] **Step 3: Add temporary instrumentation to observe real-world fallback rate**

In `getRailRouteGeometry` (`lib/rail-route.ts`), the loop at lines 237-258 already tracks `usedRail` as a boolean but discards per-leg detail. Change it to count legs:
```ts
let usedRail = false;
let railLegs = 0;
let totalLegs = bboxes.length;
```
and inside the loop, wherever `usedRail = true;` is set (line 246), also do `railLegs += 1;`. After the loop (before the `dedupe` call, around line 260), add:
```ts
if (process.env.NODE_ENV !== 'production') {
  console.log(`[rail-route] ${trainNumber}: ${railLegs}/${totalLegs} legs used real rail geometry`);
}
```

- [ ] **Step 4: Observe real behavior for a live train**

With the dev server running on port 3000, open a tracking page for a real, currently-running train in Chrome, then read the server's console output (via the terminal running `npm run dev`, or `read_console_messages` if it logs client-side — this log is server-side, so check the terminal/dev server output directly). Note the ratio reported.

- [ ] **Step 5: Fix based on what Step 4 shows**

- If `railLegs` is consistently 0 (Overpass always failing): check `lib/overpass-client.ts` for the endpoint URL, timeout, and error handling — the query might be malformed or the public Overpass instance rate-limiting. Fix the actual cause found (e.g. add a fallback Overpass mirror, increase timeout, fix query syntax).
- If `railLegs` is low but not zero (snap distance too strict): increase `SNAP_DIST_KM` from 25 to 40 (rural Indian stations can be further from the nearest OSM-mapped rail way).
- If `railLegs` is high already (feature works, user just hadn't seen it yet): no code fix needed — leave the instrumentation as a permanent low-noise dev-only log (already gated on `NODE_ENV !== 'production'`) and move to Step 6.

- [ ] **Step 6: Re-run the test suite**

Run: `npm test`
Expected: all tests including the new `lib/rail-route.test.ts` PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/rail-route.ts lib/rail-route.test.ts
git commit -m "fix: instrument and fix rail-track geometry fallback rate; add snapPointToPolyline test"
```

---

### Task 11: Home map — draw the selected train's real rail-track path

**Files:**
- Modify: `components/Home/LiveMap.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `useJourney(trainNumber: string)` from `hooks/useJourney.ts` (existing — returns `{ data, isLoading, ... }` where `data.routeGeometry: [number, number][]`).
- Produces: new `LiveMapProps.routeGeometry?: [number, number][] | null` prop.

Drawing a route for every one of thousands of visible trains is out of scope (perf/architecture concern flagged in the spec). This task scopes it to the one train the user has selected, reusing data already being fetched.

- [ ] **Step 1: Fetch the selected train's journey in `app/page.tsx`**

In `app/page.tsx`, import `useJourney` from `@/hooks/useJourney`, and add near the other hooks (after line 76):
```tsx
const { data: selectedJourney } = useJourney(selected?.n ?? '');
```
React Query dedupes this against the identical call `TrainDetailCard` already makes for the same `train.n`, so this adds no extra network request when a train is selected.

- [ ] **Step 2: Pass the route geometry into `LiveMap`**

In `app/page.tsx`, update the `<LiveMap ... />` call (around line 129) to add:
```tsx
routeGeometry={selected ? selectedJourney?.routeGeometry ?? null : null}
```

- [ ] **Step 3: Render the route line in `LiveMap`**

In `components/Home/LiveMap.tsx`, add `routeGeometry` to `LiveMapProps` (line 39-46):
```ts
interface LiveMapProps {
  trains: LiveTrain[];
  stations: StationGroup[];
  onSelect: (train: LiveTrain) => void;
  onSelectStation: (station: StationGroup) => void;
  theme: TimeTheme;
  selectedNumber?: string | null;
  routeGeometry?: [number, number][] | null;
}
```
and thread it through the function signature (line 48). Inside the `map.on('load', ...)` handler, after the `stations` source/layers are added (after line 161), add a route source + line layer:
```ts
map.addSource('selected-route', {
  type: 'geojson',
  data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
});
map.addLayer({
  id: 'selected-route-line',
  type: 'line',
  source: 'selected-route',
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: {
    'line-color': 'rgb(var(--accent))',
    'line-width': 3,
    'line-opacity': 0.85,
  },
}, 'train-halo');
```
(inserting before the `train-halo` layer id so the route line sits under the train dots/arrows). Add a `pushRoute` function alongside `pushTrains`/`pushStations`:
```ts
const pushRoute = () => {
  const source = map.getSource('selected-route') as maplibregl.GeoJSONSource | null;
  if (!source) return;
  source.setData({
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: routeGeometryRef.current ?? [] },
  });
};
```
Add a `routeGeometryRef` ref (alongside the other `*Ref` refs near line 55-63): `const routeGeometryRef = useRef<[number, number][] | null>(null); routeGeometryRef.current = routeGeometry ?? null;`. Call `pushRoute()` at the end of the `map.on('load', ...)` handler (alongside `pushTrains(); pushStations();` at line 330-331), store it via `pushRouteRef` the same way `pushTrainsRef`/`pushStationsRef` are stored (line 334-335), and add a `useEffect(() => { pushRouteRef.current(); }, [routeGeometry]);` alongside the existing effects (line 347-353).

- [ ] **Step 4: Visual verification**

Load `http://localhost:3000`, select a running train from the map or search, confirm a route line traces along real track (visibly bending to follow rail corridors, not a straight beeline) between the train's stations, and that the line disappears when the train detail card is closed (`selected` becomes `null`). Test on both light and dark theme. Screenshot.

- [ ] **Step 5: Run existing map-related tests**

Run: `npx vitest run components/Map/mapStyle.test.ts`
Expected: PASS (unrelated to this change, confirms nothing in the shared map setup broke).

- [ ] **Step 6: Commit**

```bash
git add components/Home/LiveMap.tsx app/page.tsx
git commit -m "feat: draw selected train's real rail-track path on the home map"
```

---

### Task 12: Loading-state audit — skeletons for coach chart, weather, elevation, photo panels

**Files:**
- Modify: `app/track/[trainNumber]/TrackingScreen.tsx:439-452` (`ElevationChart`/`CoachOccupancy`/`ContextCard` conditional rendering)

**Interfaces:**
- Consumes: `routeContext.isLoading`, `coachChart.isLoading`, `weather.isLoading` — already available from the existing `useQuery` calls (`routeContext`, `coachChart`, `weather` at lines 183-196), just not currently read for loading state.

Today these three panels render nothing at all while loading, then pop in abruptly once data arrives — `TrainDetailCard` already has a proper skeleton pattern (lines 211-229) to follow.

- [ ] **Step 1: Add skeleton placeholders for the three panels**

Replace the conditional block at lines 439-452:
```tsx
{routeContext.data && routeContext.data.elevationProfile.length > 0 && (
  <ElevationChart
    points={routeContext.data.elevationProfile}
    currentKm={(journey.completionPercentage / 100) * journey.totalDistanceKm}
  />
)}
{coachChart.data && <CoachOccupancy chart={coachChart.data} />}
<div className="grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-1x">
  {weather.data && <ContextCard variant="weather" weather={weather.data} />}
  <ContextCard variant="sun" sun={sun} />
  {routeContext.data?.terrainFeatures.slice(0, 4).map((f) => (
    <ContextCard key={`${f.type}-${f.name}`} variant="terrain" feature={f} />
  ))}
</div>
```
with:
```tsx
{routeContext.isLoading ? (
  <div className="h-[148px] animate-pulse rounded-card bg-surface-raised/60" aria-hidden />
) : (
  routeContext.data &&
  routeContext.data.elevationProfile.length > 0 && (
    <ElevationChart
      points={routeContext.data.elevationProfile}
      currentKm={(journey.completionPercentage / 100) * journey.totalDistanceKm}
    />
  )
)}
{coachChart.isLoading ? (
  <div className="h-16 animate-pulse rounded-card bg-surface-raised/60" aria-hidden />
) : (
  coachChart.data && <CoachOccupancy chart={coachChart.data} />
)}
<div className="grid grid-cols-2 sm:grid-cols-3 gap-1x">
  {weather.isLoading ? (
    <div className="h-24 animate-pulse rounded-card bg-surface-raised/60" aria-hidden />
  ) : (
    weather.data && <ContextCard variant="weather" weather={weather.data} />
  )}
  <ContextCard variant="sun" sun={sun} />
  {routeContext.data?.terrainFeatures.slice(0, 4).map((f) => (
    <ContextCard key={`${f.type}-${f.name}`} variant="terrain" feature={f} />
  ))}
</div>
```
(the grid also picks up the explicit column-count fix from Task 8 if that task ran first — if run out of order, apply both edits to the same block without conflict).

- [ ] **Step 2: Visual verification**

Load a tracking page on a throttled connection (Chrome DevTools network throttling, or simply observe on first load before caches warm) and confirm the elevation/coach/weather panels show a pulsing skeleton block instead of empty space while their respective queries are in flight, then swap cleanly to real content. Screenshot mid-load if timing allows.

- [ ] **Step 3: Commit**

```bash
git add "app/track/[trainNumber]/TrackingScreen.tsx"
git commit -m "feat: add loading skeletons for elevation, coach occupancy, and weather panels"
```

---

### Task 13: Full-app visual verification pass

**Files:** None modified — verification only. Fix any regressions found in the files touched by prior tasks.

**Interfaces:** N/A.

- [ ] **Step 1: Sweep every screen at every target width**

Using the Chrome extension against `http://localhost:3000`, for each of 360px, 390px, 428px, and one desktop width (≥1280px), visit and screenshot:
1. Home page — default state, with search open (CommandPalette), with a train selected (TrainDetailCard), with a station selected (StationBoard).
2. Tracking page (`/track/<trainNumber>`) for a `not_started` train (PreJourneyDashboard visible), a running train, and — if reachable — a `completed` train, in both `peek` and `half` bottom-sheet states on mobile widths, and the desktop aside layout at the desktop width.
3. Both light and dark theme for each of the above (use `ThemeToggle`).

- [ ] **Step 2: Confirm the acceptance checklist**

For every screenshot in Step 1, confirm: no clipped/overlapping text, no orphaned single grid cells, the new indigo accent and boosted status colors are applied consistently, typography sizes look intentional (not a mix of near-identical sizes), and — for at least one running train with a multi-station route — the tracking page's map line and (if that train is also selected on the home page) the home map's line visibly follow real track curvature rather than a straight beeline.

- [ ] **Step 3: Fix anything found, then re-verify**

For any regression found, fix it in the relevant file from the task that introduced it, then re-screenshot that specific screen/width/theme combination to confirm the fix.

- [ ] **Step 4: Run the full test suite one final time**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Final commit (only if Step 3 produced fixes)**

```bash
git add -A
git commit -m "fix: address regressions found in full-app mobile/desktop visual verification pass"
```
