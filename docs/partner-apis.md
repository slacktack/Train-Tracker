# Train Tracker: no-login endpoint research (2026-10-11)

> **Wired in the app:** ConfirmTkt seat-availability deep link + monthly availability (`/api/availability/monthly`), RailYatri on-time rating (merged into `/api/trains/between`), ixigo/Paytm/RailYatri/MakeMyTrip/IRCTC booking links and IRCTC eCatering links (`lib/booking.ts`).
> **Correction:** ConfirmTkt `CacheTime`/`cacheTime` stamps are **IST** without a zone suffix (the newest stamp in a fresh search equals the current IST time).

Sample: NDLS→MMCT is **12952** (12951 runs MMCT→NDLS; querying 12951 NDLS→MMCT returns nulls). DOJ 25-10-2026.
Request volume: about 40 requests total across 7 sites, paced at least 1 s apart.

Legend: **VERIFIED** means a working response today, with the params reflected in the response. **UNVERIFIED/DEAD** means no working response.

---

## 1. Booking deep links

### VERIFIED

| Site | URL template | How verified | Notes |
|---|---|---|---|
| ConfirmTkt listing | `https://www.confirmtkt.com/rbooking/trains/from/{FROM}/to/{TO}/{DD-MM-YYYY}` | Rendered in Chrome: "13 Trains found between Delhi (NDLS) to Mumbai Central (MMCT)", with the date strip shown | This is the current format and it still works. The HTML is an SPA shell (curl only shows a generic title), so the params show up only after JS runs. The bundle also has the routes `/rbooking/from/...` (ixigo-bridge variant) and `/rbooking/bridge/from/...`. |
| **ConfirmTkt train + class + quota** (new) | `https://www.confirmtkt.com/rbooking/seat-availability/{TRAIN}/{FROM}/{TO}/{CLASS}/{QUOTA}/{DD-MM-YYYY}` (for example `.../12952/NDLS/MMCT/3A/GN/25-10-2026`) | Rendered in Chrome: a "Seat Availability Calendar" for 3A starting 25 Oct with GNWL/RAC/AVAILABLE per day | **This is the way to add the train number and class.** `CLASS` accepts a comma list (the code does `split(",")`). `QUOTA` takes GN/TQ/etc. (only GN was tested). |
| ixigo | `https://www.ixigo.com/search/result/train/{FROM}/{TO}/{DDMMYYYY}//{adults}/{children}/{srMen}/{srWomen}/{CLASS or ALL}` | curl 200, SSR. Hidden `#dataBE` JSON echoes `"date":"25102026","adult":2,...,"journeyClass":"3A"`, and the `<title>` is "New Delhi - Mumbai Central - 25 Oct Trains \| ixigo" | Class is verified (`3A`). No quota segment was found. |
| RailYatri | `https://www.railyatri.in/booking/trains-between-stations?from_code={FROM}&to_code={TO}&journey_date={DD-MM-YYYY}` | curl 200, SSR. The title is "NEW DELHI (NDLS) to MUMBAI CENTRAL (MMCT) Trains…", and `__NEXT_DATA__.query` echoes all 3 params | No class/quota param was found. `pageProps.booking_window` is 63. |
| MakeMyTrip | `https://www.makemytrip.com/railways/listing?from={FROM}&to={TO}&date={YYYYMMDD}&classCode=&className=All%20Classes` | Chrome only. The form showed "Sun, 25 Oct 26" and the NDLS/Mumbai trains were listed, including #12952 | **curl times out** (bot protection), so a server-side check is impossible. Link only. `classCode` values other than empty were not tested. |
| Paytm | `https://tickets.paytm.com/trains/searchTrains/{FROM}/{TO}/{YYYY-MM-DD}` | curl 200. The HTML contains "NDLS/MMCT/2026-10-25" and "25 Oct Sun" | No class/quota param was found. |
| IRCTC | `https://www.irctc.co.in/nget/train-search` | Chrome loads the page, but the form is **empty** (From/To/DD/MM/YYYY placeholders) | **No public pre-fill URL exists.** curl times out (Akamai). Deep-link to the bare page only. |

### UNVERIFIED (seen in the bundle, not rendered)
- ConfirmTkt listing also reads the query params `?o={FROM}&d={TO}&f={date}&q={QUOTA}&hl={lang}` (bundle: `source:s.get("o"), destination:s.get("d"), dateOfJourney:s.get("f"), quota:s.get("q")`). This might allow `?q=TQ` on the listing.
- ConfirmTkt routes `/rbooking/pnr-status/{pnr}`, `/rbooking/running-status/{trainNo}`, `/rbooking/schedule/{trainNo}/{src}/{dst}/{doj}`, and `/rbooking/waitlist-trends` exist in the router map but were not opened.

---

## 2. Average delay / punctuality

### VERIFIED: RailYatri trains-between-stations (with on-time rating)
```
GET https://trainticketapi.railyatri.in/api/trains-between-station-with-sa.json?from=NDLS&to=MMCT&dateOfJourney=25-10-2026
Headers: UA, Origin/Referer https://www.railyatri.in (optional header: lang: English)
```
Trimmed response (82 KB, `result_src: "RY_Cache"`):
```json
{"success":true,"train_between_stations":[{"train_number":"12952","from":"NDLS","to":"MMCT",
  "on_time_rating":9,"from_on_time_rating":10,"to_on_time_rating":9,
  "class_type":[{"coach_type":"3A","coach_count":6,"fare":"NA"}],
  "has_pantry":true,"show_tatkal_btn":true,"est_chart_time":"2026-10-11T08:55:00.000+05:30",
  "distance":1384.0,"duration":"15:40","train_type":"RAJDHANI"}],
 "alternate_trains":[...],"nearby_station":[...],"quota_n_charting_disclaimer":"..."}
```
- Fills gap 2 with a 0–10 on-time score per train and per from/to station. It also gives coach counts per class, pantry, and a Tatkal-eligible flag.
- `est_chart_time` looks cached or stale (it showed today's chart time for a 25-Oct query), so don't rely on it.
- `fare` is "NA" in this view.

### VERIFIED: RailYatri live ETA (per-station on-time rating + predicted platform)
```
GET https://livestatus.railyatri.in/api/v3/train_eta_data/{TRAIN}/{start_day}.json?start_day={0|1|2..}&user_id=&device_type_id=4&change_name=seo_train_name&lat=&lng=&claim_on_train=false&authentication_token=
```
`start_day=0` means today's run. **The empty token/user_id is accepted.**
```json
{"train_start_date":"2026-10-11","current_station_code":"SWM","delay":15,"data_from":"mntes",
 "status_as_of":"As of 3 mins ago","diverted_stations":null,"new_alert_msg":"","fog_incidence_probability":0,
 "upcoming_stations":[{"station_code":"KOTA","sta":"21:30","eta":"21:35","arrival_delay":5,
    "platform_number":2,"on_time_rating":4,"halt":10,"station_lat":25.22,"station_lng":75.88,
    "food_data":{"food_available":true,"deeplink":"http://m.rytr.in/food-home-page/12952/KOTA/MMCT/11-10-2026/0/1295?utm=lts_food_bubble"}}],
 "previous_stations":[...]}
```
- Fills gap 2 (per-station `on_time_rating` 0–10), gap 3 (`platform_number`), and gap 6 (`diverted_stations`, alert fields). It is also a third live-status source (NTES-backed).
- Fragility: the web client aborts this call after 2 s. It is an undocumented internal API.

### VERIFIED: RailYatri timetable (SSR JSON via the Next data route)
```
GET https://www.railyatri.in/_next/data/{buildId}/time-table/{TRAIN}.json?trainNumber={TRAIN}
Header: x-nextjs-data: 1
```
Get `buildId` from `__NEXT_DATA__.buildId` on any RailYatri page. Today it was `5223h65354mn74573n56v6731c071026`. **It changes on every deploy**, so re-read it from HTML and retry on 404. The plain page `https://www.railyatri.in/time-table/{TRAIN}` (SSR `__NEXT_DATA__`) works as well.
```json
{"pageProps":{"trainTimeTable":{"timeTableDaysGroup":[{"items":[{"station_code":"KOTA","platform_number":2,
   "on_time_rating":4,"halt":10,"charting_station":"KOTA Quota","retiring_room":false,
   "addition_info":{"sanctum":true,"hospital":true,"food_available":true},"fog_incidence_probability":0}]}],
 "lastRunsDelays":{"success":false,"message":"No data found."}}}}
```
- Gives static per-station on-time rating, platform, and facilities (gap 6).
- `lastRunsDelays` (true historical delays) was **empty** for 12952 today.

### UNVERIFIED / DEAD
- ixigo `GET /api/v3/trains/running/history?date=..&trainNumber=..` returns **500 `exception.no_signature_found`**. It needs a request signature, so it was not pursued.
- etrain.info `/train/{TRAIN}/history` returns 200, but the data loads through a jQuery POST to `/ajax.php` (`$.ajaxReq`). The site is anti-scrape, so this was not reproduced.
- ixigo schedule `delay` field: present but always 0 (not historical).

---

## 3. Platform numbers / coach composition

### VERIFIED: ixigo train schedule (platform per stop + rake composition)
```
GET https://www.ixigo.com/trains/v1/info/schedule/{TRAIN}?languageCode=en&scheduleRequired=true
Headers: apiKey: ixiweb!2$   clientId: ixiweb   ixiSrc: ixiweb   Referer: https://www.ixigo.com/
```
(Public web-client constants from ixigo's JS bundle. They are not user credentials.)
```json
{"data":{"info":{"code":"12952","trainType":"RAJDHANI","rakeType":"LHB","pantry":false,
   "locomotive":",En:A5,2A:A4,2A:A3,2A:A2,2A:A1,2A:AE1,2A:H1,1A:,PC:B11,3A:B10,3A:...B1,3A:",
   "locomotives":["<as above>","<reverse direction>"],"trainClassTypes":["1A","2A","3A"],"trainRunningToday":true},
 "schedules":[{"destination":{"code":"KOTA","platformCount":25,"latitude":25.22},"orgDepart":"21:40:00",
   "ifHalts":true,"platformAsString":"2","platformArray":["2"]}],"lastUpdated":1791694993000}}
```
- **Coach position (gap 3).** The `locomotive` string is the order from the engine. To parse it, split on `,`. Each token is `{prevClass}:{coach}`, shifted by one, so the sequence is Engine, A5(2A), A4(2A) … H1(1A), PC, B11(3A) … B1(3A). The second `locomotives` entry is the reversed rake.
- Platform per halt: KOTA 2, NAD 2, RTM 4, BRC 1, ST 2, BVI 7, MMCT 3. These match RailYatri.

### VERIFIED: ConfirmTkt schedule SSR page
`GET https://www.confirmtkt.com/train-schedule/{TRAIN}` returns 200 HTML with embedded JSON per stop: `"StationCode":"KOTA","ExpectedPlatformNo":"2","HaltMinutes":"10m","HasWifi":true,"Latitude":..`. Parse it from the HTML (the JSON is fragile).

### VERIFIED: ixigo station info (platform count / wifi / rating)
```
GET https://www.ixigo.com/trains-info/v1/station/station-info?stationCode=KOTA   (same ixiweb headers)
→ {"data":{"stationName":"Kota Jn","platformCount":25,"freeWifi":true,"averageRating":"4.2","latitude":25.22388,"longitude":75.88119,"nearestAirport":"KTU"}}
```

### Not used
`https://food1.railyatri.in/instant_platform_update.json` and ixigo `/api/v2/trains/platform` are crowd-sourced **write** endpoints. They were not called.

---

## 4. Tatkal / fare

### VERIFIED: ConfirmTkt monthly availability + confirmation prediction
```
GET https://api.confirmtkt.com/api/trains/{TRAIN}/monthlyavailability?source=NDLS&destination=MMCT&doj=25-10-2026&travelclasses=3A&quota=GN&enableTG=false&tGPlan=&showTGPrediction=false&email=
Headers: UA (Origin https://www.confirmtkt.com is optional)
```
It returns 31 entries, one per day from the DOJ:
```json
[{"3A":{"TrainNo":12952,"Doj":"2026-10-25T00:00:00","CurrentStatus":"GNWL87/WL31","Prediction":"92% Chance",
   "ConfirmTktStatus":"Confirm","Fare":null,"CacheTime":"2026-10-11T20:08:35.001"}}, ...]
```
- This backs the seat-availability deep link above. It gives a 31-day availability calendar with a confirmation % (new data).
- `Fare` is null. `quota=TQ` was not tested.

### UNVERIFIED
- ixigo fare `GET /api/v2/trains/fare?orgCode&destCode&travelDate&trainNo` returns 400 `INVALID_DATE_FORMAT` for DDMMYYYY, DD-MM-YYYY, and YYYY-MM-DD.
- RailYatri `GET https://sa.railyatri.in/api/seat/enquiry/{train}/{DD-MM-YYYY}/{from}/{to}/{class}/{quota}.json?...` returns `{"success":false,"message":"Invalid User Id."}`. It needs RailYatri's guest/session user id, so it was not pursued. Its own client throttles after 3 calls.
- Tatkal rules: no endpoint was found. Use static rules from IRCTC's published policy: Tatkal opens one day before the journey date from the train's origin, at 10:00 (AC) and 11:00 (non-AC). Advance reservation is 60 days (note that RailYatri reports `booking_window: 63`). RailYatri's TBS `show_tatkal_btn` flags Tatkal-eligible trains.

---

## 5. Food ordering (IRCTC eCatering)

### VERIFIED deep links (official site `www.ecatering.irctc.co.in`, Next.js)
| Purpose | URL | Verified |
|---|---|---|
| Train + station outlets | `https://www.ecatering.irctc.co.in/train/{TRAIN}/{STATION}/outlets` | 200, `__NEXT_DATA__.page="/train/[trainNo]/[stationCode]/outlets"`, query `{trainNo:"12952",stationCode:"KOTA"}` |
| Station outlets (with SEO text) | `https://www.ecatering.irctc.co.in/station/{STATION}/outlets` | 200, pageProps has "Order Food in Train at Kota railway Station" |
| PNR flow | `https://www.ecatering.irctc.co.in/{PNR}/outlets` (optional `/{STATION}`) | Route exists in `_buildManifest` and was **not opened** (no real PNR to use) |

Other routes in the manifest: `/train/{trainNo}/{stationCode}`, `/brands/{brandId}/{pnr}`, `/train-friendly/{pnr}`.

### DEAD for us
The outlets JSON at `GET https://www.ecatering.irctc.co.in/api/v2/station/outlets?stationCode=..` returns **401 "Not Authorized"**. It needs a session/token, so the app should link out only.

RailYatri also returns its own food deep links in the ETA/timetable payloads (`http://m.rytr.in/food-home-page/{train}/{stn}/{dst}/{DD-MM-YYYY}/0/{a_min}`). These belong to a private vendor; it was not confirmed whether RailYatri is IRCTC-authorized.

---

## 6. Other

- **Diversions/alerts:** available per train in the RailYatri ETA (`diverted_stations`, `new_alert_msg`, `primary_alert`).
- **Station facilities:** RailYatri timetable `retiring_room`, `addition_info{sanctum,hospital,food_available}`. ixigo station-info `freeWifi`, `platformCount`.
- **DEAD:** cancelled/rescheduled train lists.
  - NTES `enquiry.indianrail.gov.in/mntes` has a CAPTCHA (not bypassed).
  - `railyatri.in/cancelled-trains` returns 404.
  - `ixigo.com/trains/cancelled-trains` returns 500.
  - `confirmtkt.com/cancelled-trains` returns 404.
- **ixigo meta:** `GET https://www.ixigo.com/trains/v1/info/meta-data` (ixiweb headers) is VERIFIED and returns class codes with descriptions.
- **ixigo trains-between:** `GET /trains/v1/search/between/{FROM}/{TO}?date=25102026&languageCode=en` returns 500 (unverified).

## Fragility summary
- All of these are undocumented internal APIs with no published rate limits. Cache aggressively (schedule/platform/ratings daily, live ETA at 1–2 min or more).
- ixigo needs the `apiKey/clientId/ixiSrc` web constants. If they rotate, re-grep `edge.ixigo.com/rt-train-seo/pc/js/dist/ui.common.*.js`.
- The RailYatri Next `buildId` changes on each deploy.
- MakeMyTrip and IRCTC block non-browser TLS clients, so they are usable as links only.
