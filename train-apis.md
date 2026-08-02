# railjournal.in Research Notes

Research conducted by driving Chrome to https://www.railjournal.in/ (homepage map, train search
for train 12951 Mumbai Central–New Delhi Rajdhani, and the `/contribute.php` gallery page) and by
capturing live network requests (`read_network_requests`) while interacting with the site. Cross-
referenced against `/Users/tushargautam/Documents/Train-TRacker/Train-Tracker/links.md`.

**Important correction to the premise:** I could not find evidence that railjournal.in is
open-source, nor did the site expose any GitHub link, docs page, "about" page, or API reference.
`/about`, `/robots.txt`, and other guessed paths all returned the site's custom 404 ("This Page
Does Not Exist"). A web search for `"railjournal.in" open source` and `railjournal.in github`
turned up nothing — no public repo was found. So treat everything below as **reverse-engineered
from live network traffic and page copy, not as documented/confirmed facts** unless marked
otherwise.

What I actually observed: railjournal.in's homepage renders a live map branded **"RAILRADAR"**
(same name/branding as railradar.in, which is already in `links.md`) and is titled "RailRadar
Indian Railways | Live Train Running Status". Separately, `railjournal.in/contribute.php` is
branded **"RailJournal"** and is a "coming soon" community photo/loco-spotting gallery (upload
photos of trains/locos, tagged by train number, station, date). It's unclear from the site alone
whether RailJournal and RailRadar are the same company/product, a rebrand in progress, or a
white-label — a forum thread I found in search results (indiarailinfo.com) suggested they may be
"completely separate," but I could not load that page (403 Forbidden) to confirm the full context.
**I'm flagging this as unverified — worth asking the user to clarify the relationship rather than
assuming.**

---

## 1. Live train tracking

### railjournal.in's own backend (self-hosted PHP, NOT a public third-party API) — NEW, but not usable
- **Purpose**: Powers the live map/search/train-detail UI on railjournal.in itself.
- **Observed endpoints** (captured via network tab while searching train 12951):
  - `https://www.railjournal.in/index.php?action=check_train_info&trainNo=...&startDate=...&tk=...`
  - `https://www.railjournal.in/index.php?action=get_train_image&trainNo=...&tk=...`
  - `https://www.railjournal.in/index.php?action=log_analytics_event`
  - `https://www.railjournal.in/api/charts/chart.php?train=...&station=...&date=...`
  - `https://www.railjournal.in/api/charts/coach-batch.php`
  - `https://www.railjournal.in/api/charts/schedule.php?train=...`
  - `https://www.railjournal.in/api/train_gs.php?train=...` (looks like it feeds the live GPS/position marker — "gs" possibly "geo status")
- **Auth**: Requests carry a `tk=` token parameter that looks like a per-session/rotating signed
  token (long hex string), not a stable published API key. This strongly suggests it's a private,
  undocumented backend meant only for the site's own frontend — not something intended for
  external developer use.
- **Free tier / signup**: None advertised; no docs page exists for it.
- **Status vs links.md**: **NEW** in the sense it wasn't listed, but it is **not a usable public
  API** — it's railjournal.in's internal implementation detail, observed only via network
  sniffing. Do not build against it; it could break or block at any time and there's no ToS
  permitting third-party use.

### RailRadar (railradar.in) — the branding shown on railjournal.in's map
- **Purpose**: Live train running status, GPS position, delay/speed, schedules.
- **URL**: https://railradar.in/ (docs at https://railradar.in/docs, an "about" page at
  https://railradar.in/about, and a data-API landing page at
  https://railradar.in/indian-railway-data-api — found via web search, not verified live in this
  session).
- **Auth**: Per railradar.in's own marketing copy (from search snippets), it's a "developer-first
  REST API" with free access after signup.
- **Status vs links.md**: **ALREADY DOCUMENTED** — this is the same RailRadar entry already in
  `links.md` (`https://railradar.in/docs/trains-between-stations`). The railjournal.in homepage
  map appears to be a RailRadar-branded (or RailRadar-powered) product; I did not confirm a formal
  corporate/technical relationship, just that the branding and product concept (live map,
  "Track Your Train" search, delay/ETA per station) match.

---

## 2. Station / schedule data

No distinct third-party station/schedule API was visible in network traffic beyond the
`api/charts/schedule.php` and `chart.php` internal endpoints described above (which return
per-station timing/distance data rendered in the "Info" panel: station code, platform, scheduled
vs. actual arrival/departure, distance in km, non-stop station counts). These are railjournal.in's
own backend, not a separate provider. **Nothing new to add here beyond what's already covered by
RailRadar in links.md.**

---

## 3. Maps

### OpenStreetMap raw tile servers (a/b/c.tile.openstreetmap.org) + Leaflet.js — NEW (as an alternative to MapTiler)
- **Purpose**: Base map tiles for the live train-position map.
- **Observed**: Dozens of tile requests like
  `https://a.tile.openstreetmap.org/14/11616/7092.png`,
  `https://b.tile.openstreetmap.org/14/...`, `https://c.tile.openstreetmap.org/14/...`, plus the
  page attributes the map to `Leaflet | © OpenStreetMap` and links to leafletjs.com.
- **Auth**: None — OSM's standard public tile server, no key required.
- **Free tier / notes**: OSM's tile usage policy is a shared, rate-limited, best-effort free
  service intended for light use; it explicitly discourages high-volume production use without
  running your own tile server or using a paid provider (like MapTiler). Given the project already
  plans to use MapTiler (in links.md), this is not something you likely need to add, but it's
  worth noting as the reference implementation railjournal.in itself is using — i.e., they are NOT
  using MapTiler or a paid tile provider, they're using free/raw OSM tiles + Leaflet (open-source
  JS library, no key required: https://leafletjs.com).
- **Status vs links.md**: **NEW findings** — MapTiler is already in links.md as the planned tile
  provider; OpenStreetMap raw tiles + Leaflet were NOT previously listed and are what
  railjournal.in actually uses in production, for what it's worth as a reference/fallback.

---

## 4. Weather / geo / other

- I did not observe any weather, elevation, or Overpass-style POI API calls while interacting with
  railjournal.in's map or train-detail views. Its UI (station list, delay panel, "Occupancy" tab
  teaser) did not surface weather or elevation data in this session, so I have no evidence either
  way about whether it uses Open-Meteo, OpenWeatherMap, Open-Elevation, or Overpass — those remain
  exactly as documented in `links.md`, with nothing to confirm or contradict from this site visit.
- No PNR-status-specific endpoint was observed (I didn't test the PNR flow, if one exists — the
  site didn't surface a PNR search box, only "Track Your Train" by train number/name).
- No RapidAPI, Upstash, or other infra usage was visible or inferable from the frontend.

---

## Summary table

| Name | Category | Purpose | URL | Auth | Free tier | vs. links.md |
|---|---|---|---|---|---|---|
| railjournal.in internal PHP backend | Live tracking | Powers site's own map/search UI | `railjournal.in/index.php?action=...`, `railjournal.in/api/charts/*.php`, `railjournal.in/api/train_gs.php` | Session token (`tk=`), not a public key | None advertised, not for external use | NEW (but not a usable public API — internal only) |
| RailRadar | Live tracking | Live train status, position, delay/ETA | railradar.in / railradar.in/docs | API key, free tier after signup (per their marketing) | Free tier, rate-limited | Already in links.md (duplicate) |
| OpenStreetMap tile servers + Leaflet | Maps | Base map tiles + JS map library | tile.openstreetmap.org, leafletjs.com | None | Free, shared/rate-limited fair-use policy | NEW — not currently in links.md (project instead plans MapTiler) |
| Weather / elevation / Overpass | Weather/geo | n/a | n/a | n/a | n/a | Not observed on this site either way — no new info |

## Caveats / what I could NOT verify

- Could not confirm whether railjournal.in is genuinely open-source anywhere (no GitHub link found
  on-site or via web search).
- Could not load the one forum post that seemed to discuss whether RailJournal and RailRadar are
  the same entity (403 Forbidden on indiarailinfo.com).
- Did not test the "Occupancy" tab (advertised as "NOW LIVE" — coach/class-wise fullness) or PNR
  flows, since exercising every UI path risked triggering more analytics/session-token traffic
  without adding new distinct API providers to document.
- The `tk=` tokens on railjournal.in's endpoints look like signed/rotating tokens tied to the
  page session — I did not attempt to reverse-engineer or reuse them, and would not recommend
  building against this undocumented backend.
