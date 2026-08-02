# Issues Log

Every issue raised during the UI/UX overhaul session, in the order they came up. Status reflects what's been shipped as of the last push (`37329b7`) plus the open-item clock-out pass.

## Mobile layout / truncation

- [x] Text truncating badly across mobile view generally (original ask)
- [x] Home page stat row ("Live / Moving / Avg speed / Fastest") collapsing to single letters — `overflow-x-auto` + `min-w-0` bug
- [x] Header search bar squeezed to zero width, placeholder text invisible on mobile
- [x] Bottom sheet peek state: ETA value ("VADODARA JN at 21:06") clipped vertically, cut off mid-line
- [x] Stat grids (Delay/ETA/Covered/etc.) cramming into 3 columns inside the fixed-width desktop sidebar, breaking words mid-word ("ROORK" / "EE")
- [x] Never truncate with "…" anywhere — show full data, wrap instead of clip (explicit directive, applied app-wide)
- [x] Station-status dots rendering directly on top of station name text — invalid `pl-5x` Tailwind class (not in the spacing scale) silently applied zero padding
- [x] No visual cue that stat/filter rows scroll horizontally — added fade mask + chevron
- [x] Chevron scroll-cue overlapping the last visible stat instead of sitting in reserved space
- [x] "Avg speed" stat visually colliding with the scroll chevron

## Typography / visual design

- [x] Font "trash", hard to read — swapped Geist → Inter (body), added Noto Sans Devanagari for Hindi train names
- [x] Fonts/design still not good enough (round 2) — reiterated after first swap
- [x] Elevation chart too small, barely visible — enlarged and increased axis label size
- [x] Nav bar ("All trains" / "Track another") text not bold enough
- [x] Stat value text ("On time" etc.) not visually distinct — added color-coded tone (green/amber/red) to delay stat
- [x] **Overall visual redesign — "way sexier," premium SaaS feel, not "generic government website"** — design tokens, glass/shadow system, status pills, buttons, cards, header, and type polish

## Information hierarchy

- [x] Stats that matter (Delay/ETA/etc.) should sit above live-moving data (speed/position), not below
- [x] Current conditions (weather, sun, overcast/night journey) buried at the bottom, requiring scroll to see
- [x] "Where is my train right now" not clear enough — reordered origin/current/next/progress block to the top of the panel
- [x] Station list should more clearly narrate "train is here now → will reach there next," not just list times — journey-story strip + You are here / Next stop / Then / Origin / Destination labels on the timeline

## Bottom sheet (tracking page)

- [x] No clear "pull up" affordance — needed a proper notch/handle
- [x] Sheet doesn't expand to ~80% on a single pull-up (was topping out at 55%)
- [x] Content "loads late" after expanding — was conditionally mounted on state change instead of always-mounted
- [x] Scrolling down inside the sheet's content collapses/closes the whole sheet — the entire surface had `drag="y"`, indistinguishable from a scroll gesture; restricted drag to the handle only
- [x] Scroll getting stuck (unable to scroll further) in some cases near the bottom of content — added explicit `touch-action: pan-y`
- [x] Heavy `backdrop-blur-2xl` recalculating every drag frame — main source of on-device jank/lag on real iPhone

## Map / train marker

- [x] Train icon looks like a garbled blob — was a side-profile locomotive that looks broken when rotated to non-vertical headings; replaced with a top-down shape
- [x] Train icon still didn't look like an actual train after first fix — redesigned as a proper top-down capsule/nose/window silhouette
- [x] No indication of which direction the train is moving — added a light-beam ahead of the nose
- [x] Planned (remaining) route rendered as a dashed "marching ants" line, read as an uncertain guess rather than the real track — replaced with a solid casing + core line
- [x] Route line/track path not visible at all for some trains — root cause was the API grace period being cut too short in a prior fix; verified geometry still resolves via the next poll
- [x] Map colors (route line, station dots) still using the old pre-redesign palette instead of the new accent/status colors
- [x] Train marker frozen — heading/motion state was only rendered once at mount and never updated on subsequent polls
- [x] Train position snapping instantly then sitting frozen for the rest of the poll interval instead of gliding continuously

## Data correctness

- [x] Train showing "Not started" in every panel but visibly moving on the map — a live-feed GPS ping was overriding the authoritative "not started" status (found and fixed in **two** separate code paths)
- [x] Journey data taking ~9s to load — a route-geometry grace period was blocking the entire response; cut down since real geometry arrives on the next poll anyway
- [x] Search feels slow ("takes ages") — active-trains feed cache TTL was shorter than the poll interval, so searches almost always missed cache
- [x] Searching a full train name ("Lohit Express," "Shaheed Express") returning "No trains found" even when the train exists — live feed abbreviates names ("LOHIT EXP"); rewrote matching to be per-word with abbreviation tolerance
- [x] Search matching became *too* loose after that fix — a single-letter name-word ("M" from initials) was trivially matching unrelated trains ("malwa" matched a Rajdhani express); added minimum-length guards
- [x] "Not running today" label showing on trains that were, in fact, running today — date-format mismatch between two different date-string formats in the comparison
- [x] Trains disappearing entirely on the deployed Vercel app (502s, "active trains feed failed") — the stale-data fallback lived in an in-memory variable that resets per serverless instance; backed it with Redis so a snapshot survives across instances

## Search / discovery

- [x] Same-named trains (e.g. two "Malwa Superfast Express" entries) indistinguishable in search results — added a live-status line per result (Running / At station / Not running today)
- [x] No way to search by city/station to see trains currently there — added, matches against live feed position (covers current position, not full timetable — no full-route dataset exists to check every scheduled stop)
- [x] Loading indicators inconsistent across popups — shared `LoadingCue` + `LoadingSkeleton` used across train detail card, command palette, tracking page, weather/elevation/coach panels

## Not started / open

- [x] Full visual redesign pass (typography, color, layout — "premium SaaS" direction)
- [x] Consistent "fetching live data" loading cues across every popup/card, not just some
- [x] Station timeline: explicit "train is here now / next stop / then here" narration beyond current styling
