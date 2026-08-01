# API & Service Sign-Up Links

Create accounts and grab keys for each. Check off as you go, then hand me the `.env` values.

## Core (required for MVP)

- [ ] **RailRadar** — live train running status, schedules, trains-between-stations
  Docs/signup: https://railradar.in/docs/trains-between-stations
  Free tier: public API, rate-limited

- [ ] **MapTiler** — vector map tiles (dark + light), topography
  Dashboard: https://www.maptiler.com/cloud/
  Free tier: 100,000 tile requests/month

## Weather & Elevation (required for MVP — free, no signup needed for the recommended ones)

- [ ] **Open-Meteo** — weather along route (no key required)
  https://open-meteo.com/
  Free, unlimited, no API key

- [ ] **Open-Elevation** — elevation profile along track coordinates (no key required)
  https://api.open-elevation.com/api/v1/lookup
  Free & open source, no signup

- [ ] **Overpass API (OpenStreetMap)** — rivers, tunnels, bridges, national parks along route (no key required)
  https://overpass-api.de/
  Free public API, no signup

## Optional / fallback

- [ ] **OpenWeatherMap** — alternative weather source if you want richer alerts than Open-Meteo
  https://openweathermap.org/api
  Free tier: 1,000 calls/day

- [ ] **RapidAPI (Indian Railways)** — fallback/alternate live status & PNR data source
  https://rapidapi.com/category/Travel (search "Indian Railways")
  Free tier: ~500 requests/month

## Infra

- [ ] **Upstash Redis** — serverless Redis for caching API responses (schedules, tiles metadata, etc.)
  https://upstash.com/
  Free tier available

---

Once you have keys, drop them in `.env.local` (Next.js) — I'll set up the `.env.example` template to match once the project scaffold exists.
