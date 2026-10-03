import { ActiveTrain, LiveJourney, LiveLocation, SearchResult, Station } from '@/types/train';
import { searchLocalTrains, TRAINS_DB } from '@/lib/trains-db';
import { getCached, setCached } from '@/lib/redis-cache';
import { getRadarSnapshot } from '@/lib/sources/railradar';
import { getRjSnapshot } from '@/lib/sources/rj-snapshot';
import { mapRjRows } from '@/lib/sources/rj-map';
import { projectRows } from '@/lib/sources/projection';
import { searchOfflineTrains, stationCoordMap } from '@/lib/sources/offline';
import { getWimtLive } from '@/lib/sources/wimt';
import { journeyDateToWimt, wimtToTrainInfo } from '@/lib/sources/wimt-journey';
import {
  CoachChart,
  CoachEntry,
  ScheduleStation,
  TrainSchedule,
  todayInIST,
  todayInISTISO,
  istDateOffset,
} from '@/lib/rail-schedule-types';

export type { ActiveTrain };
export type {
  CoachChart,
  CoachEntry,
  ScheduleStation,
  TrainSchedule,
};
export { todayInIST, todayInISTISO, istDateOffset };

// Journey/schedule data layer. Live positions come from RailRadar (budgeted snapshot,
// schedule-projected), status from WIMT; railjournal is used only for open schedule/chart.
const BASE = 'https://railjournal.in';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const FEED_MEMO_MS = 15_000;
const FETCH_TIMEOUT_MS = 10_000;

// ─── Fetch helpers ─────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // cache:'no-store' is critical: Next.js would otherwise serve a stale
    // response from .next/cache — including an EXPIRED rj_sid session cookie.
    return await fetch(url, { ...init, cache: 'no-store', signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Open endpoints ────────────────────────────────────────────────────────

const RUNS_ON_KEYS = [
  'trainRunsOnMon',
  'trainRunsOnTue',
  'trainRunsOnWed',
  'trainRunsOnThu',
  'trainRunsOnFri',
  'trainRunsOnSat',
  'trainRunsOnSun',
] as const;

const DAY_LETTERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface ScheduleResponse {
  data?: {
    trainNumber?: string;
    trainName?: string;
    stationFrom?: string;
    stationTo?: string;
    duration?: string;
    stationList?: ScheduleStation[];
    [key: string]: unknown;
  };
}

/**
 * Static schedule (station list + run days) for a train from the OPEN
 * `api/charts/schedule.php` endpoint — no token, no cookie required.
 * Returns null for invalid/nonexistent train numbers.
 */
export async function getTrainSchedule(trainNo: string): Promise<TrainSchedule | null> {
  const res = await fetchWithTimeout(`${BASE}/api/charts/schedule.php?train=${encodeURIComponent(trainNo)}`, {
    headers: { 'User-Agent': UA, Referer: `${BASE}/` },
  });
  const json = (await res.json().catch(() => null)) as ScheduleResponse | null;
  // Payload moved from { data: {...} } to top-level fields; accept both.
  const d = (json?.data ?? json) as ScheduleResponse['data'];
  if (!d?.trainNumber || !Array.isArray(d.stationList) || d.stationList.length === 0) {
    return null;
  }
  const stationList: ScheduleStation[] = d.stationList.map((row, i) => ({
    stationCode: String(row.stationCode ?? ''),
    stationName: String(row.stationName ?? ''),
    arrivalTime: String(row.arrivalTime ?? '--'),
    departureTime: String(row.departureTime ?? '--'),
    routeNumber: String(row.routeNumber ?? '1'),
    haltTime: String(row.haltTime ?? ''),
    distance: String(row.distance ?? '0'),
    dayCount: String(row.dayCount ?? '1'),
    stnSerialNumber: String(row.stnSerialNumber ?? i + 1),
    status: String(row.status ?? ''),
  }));
  const runsOn = RUNS_ON_KEYS.filter((key) => d[key] === 'Y').map((_, i) => DAY_LETTERS[i]);
  return {
    trainNumber: d.trainNumber,
    trainName: d.trainName ?? d.trainNumber,
    stationFrom: d.stationFrom ?? stationList[0].stationCode,
    stationTo: d.stationTo ?? stationList[stationList.length - 1].stationCode,
    trainRunsOn: runsOn,
    duration: d.duration ?? '',
    stationList,
  };
}

const SCHEDULE_CACHE_TTL_S = 24 * 3600;

/** getTrainSchedule with a 24h Redis/ memory cache — safe to call in search paths. */
export async function getCachedSchedule(trainNo: string): Promise<TrainSchedule | null> {
  const key = `schedule:${trainNo}`;
  const cached = await getCached<TrainSchedule>(key);
  if (cached) return cached;
  const schedule = await getTrainSchedule(trainNo);
  if (schedule) await setCached(key, schedule, SCHEDULE_CACHE_TTL_S).catch(() => {});
  return schedule;
}

/** A train number is 5 digits (Indian railway convention). */
export function isValidTrainNumber(q: string): boolean {
  return /^\d{5}$/.test(q.trim());
}

interface CoachChartResponse {
  data?: {
    cdd?: Array<{
      coachName?: string;
      classCode?: string;
      positionFromEngine?: number | string;
      vacantBerths?: number | string;
    }>;
    trainNo?: string;
    trainName?: string;
    from?: string;
    to?: string;
  };
}

/**
 * Coach occupancy (vacant berths per coach) from the OPEN `api/charts/chart.php`
 * endpoint. `date` is ISO `YYYY-MM-DD` here — NOT the DD-Mmm-YYYY used by
 * check_train_info (the upstream clone 502s on the wrong format).
 */
export async function getCoachChart(trainNo: string, boardingStation: string, dateISO: string): Promise<CoachChart | null> {
  const qs = new URLSearchParams({
    train: trainNo,
    station: boardingStation,
    date: dateISO,
  }).toString();
  const res = await fetchWithTimeout(`${BASE}/api/charts/chart.php?${qs}`, {
    headers: { 'User-Agent': UA, Referer: `${BASE}/` },
  });
  const json = (await res.json().catch(() => null)) as CoachChartResponse | null;
  const d = (json?.data ?? json) as CoachChartResponse['data'];
  if (!Array.isArray(d?.cdd) || d.cdd.length === 0) return null;
  return {
    trainNo: d.trainNo ?? trainNo,
    trainName: d.trainName ?? '',
    from: d.from ?? '',
    to: d.to ?? '',
    coaches: d.cdd.map((c) => ({
      coachName: c.coachName ?? '',
      classCode: c.classCode ?? '',
      positionFromEngine: Number(c.positionFromEngine ?? 0),
      vacantBerths: Number(c.vacantBerths ?? 0),
    })),
  };
}

let feedCache: { trains: ActiveTrain[]; timestamp: string; fetchedAt: number } | null = null;
let feedIsStale = false;

export function isFeedStale(): boolean {
  return feedIsStale;
}

export type FeedSource = 'railjournal' | 'railradar';
let feedSource: FeedSource = 'railjournal';
export function currentFeedSource(): FeedSource {
  return feedSource;
}

/** Open CDN snapshot first (real GPS/speed); RailRadar's budgeted, schedule-projected snapshot as fallback. */
export async function getActiveTrains(force = false): Promise<ActiveTrain[]> {
  const now = Date.now();
  if (!force && feedCache && now - feedCache.fetchedAt < FEED_MEMO_MS) return feedCache.trains;

  const rj = await getRjSnapshot();
  if (rj) {
    feedCache = { trains: mapRjRows(rj.rows, now), timestamp: rj.timestamp, fetchedAt: now };
    feedIsStale = false;
    feedSource = 'railjournal';
    return feedCache.trains;
  }

  const { snapshot, stale } = await getRadarSnapshot();
  feedCache = { trains: projectRows(snapshot.rows, snapshot.fetchedAt, now), timestamp: snapshot.timestamp, fetchedAt: now };
  feedIsStale = stale;
  feedSource = 'railradar';
  return feedCache.trains;
}

/** Station -> [lat, lon] from the bundled offline station table. */
export async function getStationCoords(): Promise<Map<string, [number, number]>> {
  return stationCoordMap();
}

export interface RailJournalTimetableRow {
  sr: string;
  station_code: string;
  station_name: string;
  distance: string;
  sta: string;
  eta: string;
  std: string;
  etd: string;
  has_arrived: string;
  has_departed: string;
  delay_arrival: string;
  delay_departure: string;
  pf: string;
  /** Coordinates the live source sent for this stop; trusted over the offline table. */
  lat?: number;
  lng?: number;
  arrival_cancel_flag?: string;
  departure_cancel_flag?: string;
}

export interface RailJournalTrainInfo {
  status: boolean;
  train_no: string;
  train_name: string | null;
  train_name_unicode?: string | null;
  train_sub_type: string;
  start_date: string;
  current_location: string | null;
  loco_speed: number;
  /** Headline delay when the source reports one directly (WIMT). */
  live_delay_min?: number;
  current_position: {
    description: string;
    train_source: string;
    train_destination: string;
    train_status_last_location: string;
  };
  train_public_time_table: RailJournalTimetableRow[];
}

/** Running status + timetable for one journey (WIMT). null for unknown trains. */
export async function getTrainInfo(trainNo: string, startDate: string): Promise<RailJournalTrainInfo | null> {
  const schedule = await getCachedSchedule(trainNo).catch(() => null);
  const live = await getWimtLive({
    trainNo,
    from: schedule?.stationFrom,
    to: schedule?.stationTo,
    date: journeyDateToWimt(startDate),
  }).catch(() => null);
  if (!live) return null;
  return wimtToTrainInfo(live, { trainNo, schedule });
}

// ─── Journey start-date resolution ─────────────────────────────────────────
// check_train_info is keyed by the journey's ACTUAL start date, not today.
// Querying with the wrong date makes a mid-route train (departed last night)
// answer "Yet to start" — the single most common reason tracking showed
// "not started" for trains that were genuinely running. Resolution order:
//   1. The open feed's per-train start_date (ground truth — it's the same
//      value railjournal's own UI uses) when the train is broadcasting.
//   2. A previously resolved date cached per train.
//   3. Probing today → yesterday → day-before → 2 days back, taking the
//      first response with real progress (a live, unfinished journey).

/** Feed start_date is "02 Aug" (space-separated, no year) → "02-Aug-YYYY". */
function normalizeFeedStartDate(raw: string | undefined, fallbackYearDate: string): string {
  if (!raw) return fallbackYearDate;
  const m = raw.trim().match(/^(\d{1,2})[- ]([A-Za-z]{3})/);
  if (m) {
    const month = m[2][0].toUpperCase() + m[2].slice(1, 3).toLowerCase();
    return `${m[1].padStart(2, '0')}-${month}-${fallbackYearDate.split('-')[2]}`;
  }
  return raw.trim();
}

export function isValidJourneyDate(value: string | undefined): value is string {
  return !!value && /^\d{2}-[A-Z][a-z]{2}-\d{4}$/.test(value);
}

/** A response is "live" when any station has progress but the final stop hasn't arrived. */
function isLiveJourneyResponse(info: RailJournalTrainInfo): boolean {
  const rows = info.train_public_time_table;
  if (!rows || rows.length === 0) return false;
  const hasProgress = rows.some(
    (r) => (r.has_arrived && r.has_arrived !== '-') || (r.has_departed && r.has_departed !== '-')
  );
  if (!hasProgress) return false;
  const last = rows[rows.length - 1];
  return !(last.has_arrived && last.has_arrived !== '-');
}

const START_DATE_CACHE_KEY = (trainNo: string) => `journey-start:${trainNo}`;
const START_DATE_TTL_S = 12 * 3600;
const startDateCache = new Map<string, { date: string; expiresAt: number }>();

async function getCachedStartDate(trainNo: string): Promise<string | null> {
  const mem = startDateCache.get(trainNo);
  if (mem && mem.expiresAt > Date.now()) return mem.date;
  const redis = await getCached<{ date: string }>(START_DATE_CACHE_KEY(trainNo)).catch(() => null);
  if (redis?.date) {
    startDateCache.set(trainNo, { date: redis.date, expiresAt: Date.now() + START_DATE_TTL_S * 1000 });
    return redis.date;
  }
  return null;
}

async function rememberStartDate(trainNo: string, date: string) {
  startDateCache.set(trainNo, { date, expiresAt: Date.now() + START_DATE_TTL_S * 1000 });
  await setCached(START_DATE_CACHE_KEY(trainNo), { date }, START_DATE_TTL_S).catch(() => {});
}

/**
 * Find the journey's real start date and fetch its running status.
 * Returns null only when the train number doesn't exist at all.
 */
async function resolveJourneyInfo(
  trainNo: string,
  activeTrains: ActiveTrain[]
): Promise<{ info: RailJournalTrainInfo; startDate: string } | null> {
  const today = todayInIST();
  const feedTrain = activeTrains.find((t) => t.train_no === trainNo);
  const cachedDate = await getCachedStartDate(trainNo);

  const candidates: string[] = [];
  const push = (date: string | null | undefined) => {
    if (date && !candidates.includes(date)) candidates.push(date);
  };
  push(feedTrain?.start_date ? normalizeFeedStartDate(feedTrain.start_date, today) : null);
  push(cachedDate);
  for (const daysAgo of [0, 1, 2, 3]) push(daysAgo === 0 ? today : istDateOffset(daysAgo));

  const inFeedOrDb = !!feedTrain || TRAINS_DB.some((t) => t.number === trainNo);
  const validNumber = isValidTrainNumber(trainNo);

  let firstValid: { info: RailJournalTrainInfo; startDate: string } | null = null;

  for (const date of candidates) {
    const info = await getTrainInfo(trainNo, date);
    if (!info || !Array.isArray(info.train_public_time_table) || info.train_public_time_table.length === 0) {
      // First candidate answered nothing and the train is unknown outside
      // the feed/DB (a bogus number) — don't burn 4 authed probes on it.
      if (!firstValid && !inFeedOrDb && !validNumber) return null;
      continue;
    }
    const attempt = { info, startDate: date };
    firstValid ??= attempt;
    if (isLiveJourneyResponse(info)) {
      await rememberStartDate(trainNo, date);
      return attempt;
    }
    // Genuinely not started yet: the response itself confirms today is the
    // journey's start date, so nothing older can be "more live" for it.
    if (date === today && normalizeFeedStartDate(info.start_date, today) === today) {
      await rememberStartDate(trainNo, today);
      return attempt;
    }
  }

  return firstValid;
}

// ─── Normalizers (railjournal raw → app types) ─────────────────────────────

function parseDelay(value: string | undefined): number {
  if (!value) return 0;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

function parseDistanceKm(value: string | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** "17:00 02-Aug" / "03:15 03-Aug" / "17:00" → "17:00" / "03:15". */
function formatTime(raw: string | undefined): string | undefined {
  if (!raw || raw === '-' || raw === 'On Time*') return undefined;
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : undefined;
}

/**
 * railjournal.in ships Devanagari names as HTML entities (e.g. "&#2327;&#2352;&#2366;&#2361;")
 * inside check_train_info responses. Decode numeric + named entities so the UI
 * renders गराह गोंदिया instead of the raw entity string.
 */
function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g,
    (_match, entity: string) => {
      if (entity[0] === '#') {
        const code = entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : _match;
      }
      const named: Record<string, string> = {
        amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
      };
      return named[entity] ?? _match;
    },
  );
}

function deriveStatus(
  info: RailJournalTrainInfo,
  maxDelay: number
): LiveJourney['status'] {
  const msg = info.current_position?.train_status_last_location ?? '';
  if (msg.includes('Cancelled') || msg.toLowerCase().includes('cancelled')) return 'cancelled';
  // "Arrived at X(CODE)" fires for EVERY intermediate station, not just the
  // final one — a train mid-route arriving at station 5 of 12 produces the
  // exact same "Arrived at ..." message as one that's actually finished.
  // Only treat it as journey-complete when the arrived station is the
  // timetable's last stop.
  const arrivedMatch = msg.match(/Arrived at .*?\(([A-Z0-9]+)\)/);
  if (arrivedMatch) {
    const arrivedCode = arrivedMatch[1];
    const lastStop = info.train_public_time_table[info.train_public_time_table.length - 1];
    if (lastStop && arrivedCode === lastStop.station_code) return 'completed';
  } else if (msg.includes('Completed')) {
    return 'completed';
  }
  if (msg.includes('Yet to start')) return 'not_started';
  return maxDelay >= 15 ? 'delayed' : 'on_time';
}

/** Latest delay among stations that have already passed/departed. */
function maxTimetableDelay(rows: RailJournalTimetableRow[]): number {
  let max = 0;
  for (const row of rows) {
    const departed = row.has_departed && row.has_departed !== '-';
    if (!departed) continue;
    max = Math.max(max, parseDelay(row.delay_arrival), parseDelay(row.delay_departure));
  }
  return max;
}

function buildStations(
  info: RailJournalTrainInfo,
  coords: Map<string, [number, number]>
): Station[] {
  const notStarted = deriveStatus(info, 0) === 'not_started';
  return info.train_public_time_table.map((row, i) => {
    const c: [number, number] | undefined = row.lat && row.lng ? [row.lat, row.lng] : coords.get(row.station_code);
    const arrived = row.has_arrived && row.has_arrived !== '-';
    const departed = row.has_departed && row.has_departed !== '-';

    let status: Station['status'];
    if (departed) status = 'passed';
    else if (arrived) status = 'current';
    else if (notStarted && i === 0) status = 'current';
    else status = 'upcoming';

    return {
      code: row.station_code,
      name: row.station_name || row.station_code,
      lat: c?.[0] ?? 0,
      lng: c?.[1] ?? 0,
      scheduledArrival: formatTime(row.sta) || '--:--',
      scheduledDeparture: formatTime(row.std) || '--:--',
      actualArrival: formatTime(row.eta) || undefined,
      actualDeparture: formatTime(row.etd) || undefined,
      delayMinutes: Math.max(parseDelay(row.delay_arrival), parseDelay(row.delay_departure)),
      distanceKm: parseDistanceKm(row.distance),
      status,
      platform: row.pf && row.pf !== '*' ? row.pf : undefined,
    };
  });
}

/** Build route geometry from timetable stations (skipping unknown coords). */
function buildRouteGeometry(
  stations: Station[],
  fallbackOrigin: [number, number] | null,
  fallbackDestination: [number, number] | null
): [number, number][] | undefined {
  const coords: [number, number][] = [];
  for (const s of stations) {
    if (s.lat && s.lng) {
      const last = coords[coords.length - 1];
      if (!last || last[0] !== s.lng || last[1] !== s.lat) {
        coords.push([s.lng, s.lat]);
      }
    }
  }
  if (coords.length >= 2) return coords;
  if (fallbackOrigin && fallbackDestination) {
    return [fallbackOrigin, fallbackDestination];
  }
  return undefined;
}

/** Interpolate a point at pct% (0–100) along a polyline of [lng, lat] coords. */
export function interpolatePolyline(coords: [number, number][], pct: number): [number, number] {
  if (!coords || coords.length === 0) return [77.2194, 28.643];
  if (coords.length === 1 || pct <= 0) return coords[0];
  if (pct >= 100) return coords[coords.length - 1];

  const distances: number[] = [0];
  let totalDist = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    const dx = lng2 - lng1;
    const dy = lat2 - lat1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    totalDist += dist;
    distances.push(totalDist);
  }

  if (totalDist === 0) return coords[0];

  const targetDist = (pct / 100) * totalDist;
  for (let i = 1; i < coords.length; i++) {
    if (distances[i] >= targetDist) {
      const segStartDist = distances[i - 1];
      const segLen = distances[i] - segStartDist;
      const t = segLen > 0 ? (targetDist - segStartDist) / segLen : 0;
      const [lng1, lat1] = coords[i - 1];
      const [lng2, lat2] = coords[i];
      return [lng1 + t * (lng2 - lng1), lat1 + t * (lat2 - lat1)];
    }
  }
  return coords[coords.length - 1];
}

interface NormaliseOptions {
  activeTrains: ActiveTrain[];
  stationCoords: Map<string, [number, number]>;
  fallbackOrigin?: [number, number] | null;
  fallbackDestination?: [number, number] | null;
  /** The journey's actual start date (DD-Mmm-YYYY) — the date whose status this journey describes. */
  startDate?: string;
}

export function normaliseJourney(info: RailJournalTrainInfo, options: NormaliseOptions): LiveJourney {
  const { activeTrains, stationCoords, fallbackOrigin = null, fallbackDestination = null, startDate } = options;

  const stations = dropCoordOutliers(buildStations(info, stationCoords));
  const maxDelay = info.live_delay_min ?? maxTimetableDelay(info.train_public_time_table);
  const status = deriveStatus(info, maxDelay);

  const passed = stations.filter((s) => s.status === 'passed');
  const currentStation = stations.find((s) => s.status === 'current');
  const nextStation = stations.find((s) => s.status === 'upcoming');

  const totalDistanceKm = stations[stations.length - 1]?.distanceKm ?? 0;
  const coveredKm = currentStation?.distanceKm ?? passed[passed.length - 1]?.distanceKm ?? 0;
  const completion =
    totalDistanceKm > 0 ? Math.min(100, Math.max(0, (coveredKm / totalDistanceKm) * 100)) : 0;

  // GPS position from the open feed when available (best source of truth).
  const gpsTrain = activeTrains.find((t) => t.train_no === info.train_no);

  const routeGeometry = buildRouteGeometry(stations, fallbackOrigin, fallbackDestination);

  let trainLat: number;
  let trainLng: number;
  let heading: number;
  let positionSource: LiveLocation['positionSource'];
  // A train number can show up in the live GPS feed before its authoritative
  // status says the journey has begun (a positioning move, the previous
  // day's returning rake, feed lag) — trusting that GPS fix here would put
  // the marker mid-route while the card still (correctly) says "not started".
  // Origin-station coordinates are the honest answer until status flips.
  if (status !== 'not_started' && gpsTrain && Number.isFinite(gpsTrain.lat) && Number.isFinite(gpsTrain.lon)) {
    trainLat = gpsTrain.lat;
    trainLng = gpsTrain.lon;
    heading = gpsTrain.heading ?? 45;
    positionSource = 'gps';
  } else if (currentStation?.lat && currentStation?.lng) {
    trainLat = currentStation.lat;
    trainLng = currentStation.lng;
    heading = 45;
    positionSource = 'station';
  } else if (routeGeometry && routeGeometry.length >= 2) {
    const [lng, lat] = interpolatePolyline(routeGeometry, completion);
    trainLng = lng;
    trainLat = lat;
    heading = 45;
    positionSource = 'projected';
  } else {
    trainLat = 0;
    trainLng = 0;
    heading = 45;
    positionSource = 'none';
  }

  const speedKmh = status === 'not_started' ? 0 : Math.round(info.loco_speed || gpsTrain?.speedKmh || 0);
  const isMoving =
    speedKmh > 0 || ((status === 'on_time' || status === 'delayed') && positionSource === 'gps');

  const origin = stations[0];
  const destination = stations[stations.length - 1];

  let etaText: string;
  if (nextStation?.scheduledArrival && nextStation.scheduledArrival !== '--:--') {
    etaText = `${nextStation.name} at ${nextStation.scheduledArrival}`;
  } else if (status === 'not_started' && origin?.scheduledDeparture) {
    etaText = `Departs ${origin.name} at ${origin.scheduledDeparture}`;
  } else if (status === 'completed' && destination) {
    etaText = `Arrived ${destination.name}`;
  } else {
    etaText = 'Awaiting live data';
  }

  return {
    trainId: info.train_no,
    number: info.train_no,
    name: info.train_name ?? info.train_no,
    nameUnicode: info.train_name_unicode ? decodeHtmlEntities(info.train_name_unicode) : undefined,
    type: info.train_sub_type,
    startDate,
    origin: { code: origin?.code ?? info.current_position?.train_source ?? '', name: origin?.name ?? '' },
    destination: { code: destination?.code ?? info.current_position?.train_destination ?? '', name: destination?.name ?? '' },
    currentLocation: { lat: trainLat, lng: trainLng, heading, speedKmh, isMoving, positionSource },
    status,
    delayMinutes: maxDelay,
    speedKmh,
    distanceCoveredKm: coveredKm,
    remainingDistanceKm: Math.max(0, totalDistanceKm - coveredKm),
    totalDistanceKm,
    completionPercentage: Math.round(completion * 10) / 10,
    lastUpdated: new Date().toISOString(),
    ETA: etaText,
    previousStation: passed[passed.length - 1],
    currentStation,
    nextStation,
    stations,
    routeGeometry,
  };
}

// ─── Fallback Journey Generator ──────────────────────────────────────────

export function generateFallbackJourney(trainNumber: string): LiveJourney | null {
  const train = TRAINS_DB.find((t) => t.number === trainNumber) || {
    number: trainNumber,
    name: `Express Train #${trainNumber}`,
    from: 'Mumbai Central',
    fromCode: 'MMCT',
    to: 'New Delhi',
    toCode: 'NDLS',
  };

  const stations: Station[] = [
    {
      code: train.fromCode,
      name: train.from,
      lat: 18.9696,
      lng: 72.8193,
      scheduledArrival: '17:00',
      scheduledDeparture: '17:00',
      actualArrival: '17:00',
      actualDeparture: '17:00',
      delayMinutes: 0,
      distanceKm: 0,
      status: 'passed',
      platform: '1',
    },
    {
      code: 'ST',
      name: 'Surat',
      lat: 21.2049,
      lng: 72.8406,
      scheduledArrival: '20:10',
      scheduledDeparture: '20:15',
      actualArrival: '20:14',
      actualDeparture: '20:19',
      delayMinutes: 4,
      distanceKm: 263,
      status: 'passed',
      platform: '1',
    },
    {
      code: 'KOTA',
      name: 'Kota Junction',
      lat: 25.2138,
      lng: 75.8648,
      scheduledArrival: '03:15',
      scheduledDeparture: '03:25',
      actualArrival: '03:23',
      actualDeparture: '03:33',
      delayMinutes: 8,
      distanceKm: 920,
      status: 'current',
      platform: '1',
    },
    {
      code: train.toCode,
      name: train.to,
      lat: 28.643,
      lng: 77.2194,
      scheduledArrival: '08:32',
      scheduledDeparture: '08:32',
      delayMinutes: 8,
      distanceKm: 1384,
      status: 'upcoming',
      platform: '1',
    },
  ];

  return {
    trainId: train.number,
    number: train.number,
    name: train.name,
    origin: { code: train.fromCode, name: train.from },
    destination: { code: train.toCode, name: train.to },
    currentLocation: {
      lat: 25.2138,
      lng: 75.8648,
      heading: 45,
      speedKmh: 110,
      isMoving: true,
      positionSource: 'projected',
    },
    status: 'running',
    delayMinutes: 8,
    speedKmh: 110,
    distanceCoveredKm: 920,
    remainingDistanceKm: 464,
    totalDistanceKm: 1384,
    completionPercentage: 66.5,
    lastUpdated: new Date().toISOString(),
    ETA: 'Kota Junction at 03:15',
    previousStation: stations[1],
    currentStation: stations[2],
    nextStation: stations[3],
    stations,
    routeGeometry: [
      [72.8193, 18.9696],
      [72.8406, 21.2049],
      [75.8648, 25.2138],
      [77.2194, 28.643],
    ],
  };
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Search stays fully local (instant, offline, no API cost). Railjournal has no
 * search endpoint — the site's "search" is a frontend mock.
 *
 * When the local DB + live feed both miss, fall back to the OPEN schedule.php
 * endpoint: it resolves ANY 5-digit train number to its name + route, which
 * covers trains that aren't in the static DB and aren't running today (e.g.
 * 15651 LOHIT EXPRESS runs Mondays only).
 */
/**
 * Live-feed train names are heavily abbreviated ("LOHIT EXP", "SF" for
 * Superfast) compared to how a rider actually types a search ("Lohit
 * Express"). A single substring test on the whole phrase fails on almost
 * any abbreviation. Instead: split the query into words and require every
 * word to match some word in the name, where a match is either an exact
 * substring OR a prefix relationship in either direction (covers
 * "express" matching the name-word "exp", and "exp" matching "express").
 */
function nameMatchesQuery(name: string, query: string): boolean {
  const nameWords = name.toLowerCase().split(/\s+/).filter(Boolean);
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (queryWords.length === 0) return false;
  return queryWords.every((qw) =>
    nameWords.some((nw) => {
      if (nw.includes(qw)) return true;
      // Abbreviation prefix match in either direction ("exp" <-> "express"),
      // but only once both sides are long enough to be a real word/abbreviation
      // — otherwise a single-letter initial ("M" in "M G R ...") trivially
      // prefix-matches almost any query.
      if (qw.length >= 3 && nw.length >= 2 && qw.startsWith(nw)) return true;
      if (nw.length >= 3 && qw.length >= 2 && nw.startsWith(qw)) return true;
      return false;
    })
  );
}

/**
 * Same-named trains (an "up" and "down" service, or one running today vs
 * one that hasn't started yet) are otherwise indistinguishable in a result
 * list until you tap in. Derive a short status from the one thing the feed
 * actually tells us: source (GPS = confirmed moving), speed, and position.
 * Note: a start_date of YESTERDAY does NOT mean "not running" — overnight
 * trains are mid-route since yesterday and the feed carries them live.
 * Only a start date strictly AFTER today means the journey hasn't begun.
 */
function describeLiveNote(t: ActiveTrain, todayPrefix: string): string {
  const started = t.start_date?.trim();
  if (started && started > todayPrefix) return 'Not running yet';
  if (t.source === 'GPS' && (t.speedKmh ?? 0) > 0) return `Running · ${Math.round(t.speedKmh ?? 0)} km/h`;
  if (t.source === 'GPS') return 'Running · stopped';
  return t.station_name ? `At ${t.station_name.replace(/\s+/g, ' ').trim()}` : 'At station';
}

export async function searchTrains(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
  // todayInIST() returns "DD-Mmm-YYYY"; the feed's start_date is "DD Mon" (space-separated).
  const todayPrefix = todayInIST().split('-').slice(0, 2).join(' ');
  const todayWeekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(new Date());

  const curated = searchLocalTrains(q);
  const seen = new Set(curated.map((t) => t.number));
  const fromOffline = searchOfflineTrains(q, 12)
    .filter((t) => !seen.has(t.number))
    .map((t) => ({ number: t.number, name: t.name, from: '', fromCode: '', to: '', toCode: '' }));
  const local = [...curated, ...fromOffline].slice(0, 12);
  if (local.length > 0) {
    const feedForLocal = await getActiveTrains().catch(() => []);
    const results: SearchResult[] = [];
    // Trains absent from the live feed get schedule-backed context (run days,
    // departure time) instead of a dead-end "Not currently running" — the
    // schedule endpoint is open and Redis-cached, so this is cheap. Capped so
    // a broad query can't fan out 15 upstream calls per keystroke.
    const needsSchedule = local.filter((t) => !feedForLocal.some((f) => f.train_no === t.number)).slice(0, 8);
    const schedules = await Promise.all(
      needsSchedule.map((t) => getCachedSchedule(t.number).catch(() => null))
    );
    const scheduleByNumber = new Map(needsSchedule.map((t, i) => [t.number, schedules[i]]));

    for (const t of local) {
      const live = feedForLocal.find((f) => f.train_no === t.number);
      const schedule = scheduleByNumber.get(t.number);
      const runsToday = !!schedule?.trainRunsOn.includes(todayWeekday);
      const dep = schedule?.stationList[0]?.departureTime;
      const arr = schedule?.stationList[schedule.stationList.length - 1]?.arrivalTime;
      let liveNote: string;
      if (live) {
        liveNote = describeLiveNote(live, todayPrefix);
      } else if (schedule && runsToday && dep && dep !== '--') {
        liveNote = `Departs today · ${dep}`;
      } else if (schedule && runsToday) {
        liveNote = 'Runs today';
      } else if (schedule && schedule.trainRunsOn.length > 0) {
        liveNote = `Runs ${schedule.trainRunsOn.join(', ')}`;
      } else {
        liveNote = 'Not currently running';
      }
      results.push({
        id: t.number,
        number: t.number,
        name: t.name,
        origin: {
          code: t.fromCode || schedule?.stationFrom || '',
          name: t.from || clean(schedule?.stationList[0]?.stationName ?? ''),
        },
        destination: {
          code: t.toCode || schedule?.stationTo || '',
          name: t.to || clean(schedule?.stationList[schedule.stationList.length - 1]?.stationName ?? ''),
        },
        runsOn: schedule?.trainRunsOn,
        duration: schedule?.duration || undefined,
        departureTime: dep && dep !== '--' ? dep : undefined,
        arrivalTime: arr && arr !== '--' ? arr : undefined,
        liveNote,
      });
    }
    return results;
  }

  const feed = await getActiveTrains().catch(() => []);
  const matches = feed.filter(
    (t) => t.train_no.startsWith(q) || nameMatchesQuery(t.train_name ?? '', q)
  );
  if (matches.length > 0) {
    return matches.slice(0, 15).map((t) => ({
      id: t.train_no,
      number: t.train_no,
      name: clean(t.train_name ?? t.train_no),
      origin: { code: t.station_code ?? '', name: clean(t.station_name ?? '') },
      destination: { code: '', name: '' },
      liveNote: describeLiveNote(t, todayPrefix),
    }));
  }

  // No train matched by number/name — try it as a city/station name instead,
  // surfacing trains currently at or passing through there. This only covers
  // a train's *current* position (from the live feed), not its full
  // timetable, so a train that will reach this city later today won't show
  // up yet — there's no full-route database to check every stop against.
  const cityMatches = feed.filter((t) => t.station_name && nameMatchesQuery(t.station_name, q));
  if (cityMatches.length > 0) {
    return cityMatches.slice(0, 20).map((t) => ({
      id: t.train_no,
      number: t.train_no,
      name: clean(t.train_name ?? t.train_no),
      origin: { code: t.station_code ?? '', name: clean(t.station_name ?? '') },
      destination: { code: '', name: '' },
      liveNote: describeLiveNote(t, todayPrefix),
    }));
  }

  if (isValidTrainNumber(q)) {
    const schedule = await getTrainSchedule(q).catch(() => null);
    if (schedule) {
      const first = schedule.stationList[0];
      const last = schedule.stationList[schedule.stationList.length - 1];
      const dep = first?.departureTime && first.departureTime !== '--' ? first.departureTime : undefined;
      const arr = last?.arrivalTime && last.arrivalTime !== '--' ? last.arrivalTime : undefined;
      const liveMatch = feed.find((f) => f.train_no === schedule.trainNumber);
      return [
        {
          id: schedule.trainNumber,
          number: schedule.trainNumber,
          name: schedule.trainName,
          origin: { code: first?.stationCode ?? schedule.stationFrom, name: clean(first?.stationName ?? schedule.stationFrom) },
          destination: { code: last?.stationCode ?? schedule.stationTo, name: clean(last?.stationName ?? schedule.stationTo) },
          runsOn: schedule.trainRunsOn,
          duration: schedule.duration || undefined,
          departureTime: dep,
          arrivalTime: arr,
          liveNote: liveMatch ? describeLiveNote(liveMatch, todayPrefix) : 'Not currently running',
        },
      ];
    }
  }

  return [];
}

/**
 * Live journey for a train: check_train_info + GPS merge from the open feed.
 * Resolves the journey's ACTUAL start date (see resolveJourneyInfo) so an
 * overnight train that departed yesterday doesn't come back "not started".
 * `dateOverride` (DD-Mmm-YYYY) pins the journey to a specific start date —
 * used by the date chips on the tracking screen when auto-detection misses.
 * Throws on network failure — callers decide how to fall back.
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

/**
 * Some stations in the offline table carry wrong coordinates, which drags the route line (and a dot)
 * hundreds of km off course. A stop that sits far off the line between its neighbours is dropped.
 */
export function dropCoordOutliers<T extends { lat: number; lng: number }>(stations: T[]): T[] {
  const ok = (s: T) => !!s.lat && !!s.lng;
  const d = (a: T, b: T) => haversineKm(a.lat, a.lng, b.lat, b.lng);
  const out = stations.map((s) => ({ ...s }));
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < out.length; i++) {
      if (!ok(out[i])) continue;
      let p = i - 1;
      while (p >= 0 && !ok(out[p])) p--;
      let n = i + 1;
      while (n < out.length && !ok(out[n])) n++;
      const a = p >= 0 ? out[p] : null;
      const b = n < out.length ? out[n] : null;
      // Only a clear spike: well over three times the gap between the neighbours, and more than 120 km out of the way.
      const bad = !!a && !!b && d(a, out[i]) + d(out[i], b) - d(a, b) > 3 * d(a, b) + 120;
      if (bad) {
        out[i].lat = 0;
        out[i].lng = 0;
      }
    }
  }
  return out;
}

/** Dense route line from every scheduled station (halts and pass-throughs), lightly smoothed. */
export function denseRouteFromSchedule(schedule: TrainSchedule): [number, number][] | undefined {
  const coords = stationCoordMap();
  const pts: [number, number][] = [];
  for (const row of schedule.stationList) {
    const c = coords.get(row.stationCode);
    if (!c) continue;
    const last = pts[pts.length - 1];
    if (!last || last[0] !== c[1] || last[1] !== c[0]) pts.push([c[1], c[0]]);
  }
  if (pts.length < 2) return undefined;
  // Drop stations whose coordinates jut far off the line between their neighbours (bad data).
  const km = (a: [number, number], b: [number, number]) => haversineKm(a[1], a[0], b[1], b[0]);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = pts.length - 2; i >= 1; i--) {
      const direct = km(pts[i - 1], pts[i + 1]);
      if (km(pts[i - 1], pts[i]) + km(pts[i], pts[i + 1]) > direct * 2.2 + 25) pts.splice(i, 1);
    }
  }
  // Chaikin corner cutting: rounds the angles between stations without moving the line far.
  let line = pts;
  for (let i = 0; i < 2 && line.length < 600; i++) {
    const next: [number, number][] = [line[0]];
    for (let k = 0; k < line.length - 1; k++) {
      const [ax, ay] = line[k];
      const [bx, by] = line[k + 1];
      next.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    next.push(line[line.length - 1]);
    line = next;
  }
  return line;
}

export async function getLiveJourney(trainNumber: string, dateOverride?: string): Promise<LiveJourney | null> {
  const [activeTrains, stationCoords] = await Promise.all([
    getActiveTrains().catch(() => [] as ActiveTrain[]),
    getStationCoords(),
  ]);

  let info: RailJournalTrainInfo | null = null;
  let resolvedStartDate: string | undefined = dateOverride;
  if (dateOverride && isValidJourneyDate(dateOverride)) {
    info = await getTrainInfo(trainNumber, dateOverride).catch(() => null);
    if (info && (!Array.isArray(info.train_public_time_table) || info.train_public_time_table.length === 0)) {
      info = null;
    }
  } else {
    const resolved = await resolveJourneyInfo(trainNumber, activeTrains);
    info = resolved?.info ?? null;
    resolvedStartDate = resolved?.startDate;
  }

  const timetable = info?.train_public_time_table;

  // The authed endpoint is the source of truth for *live* position, but it
  // returns an EMPTY timetable for trains not running today (e.g. 15651 runs
  // Mondays only). In that case hydrate from the OPEN schedule endpoint so the
  // journey still shows origin/destination + full station list + rail geometry.
  if (!info || !Array.isArray(timetable) || timetable.length === 0) {
    const schedule = await getTrainSchedule(trainNumber).catch(() => null);
    if (schedule) {
      return buildJourneyFromSchedule(schedule, activeTrains, stationCoords, info?.train_name_unicode ?? undefined);
    }
    if (!info) return null;
  }

  const fallback = generateFallbackJourney(trainNumber);
  const fallbackOrigin: [number, number] | null = fallback?.stations[0]?.lat
    ? [fallback.stations[0].lng, fallback.stations[0].lat]
    : null;
  const fallbackDestination: [number, number] | null = fallback?.stations[fallback.stations.length - 1]?.lat
    ? [fallback.stations[fallback.stations.length - 1].lng, fallback.stations[fallback.stations.length - 1].lat]
    : null;

  const journey = normaliseJourney(info, {
    activeTrains,
    stationCoords,
    fallbackOrigin,
    fallbackDestination,
    startDate: resolvedStartDate,
  });
  const fullSchedule = await getCachedSchedule(trainNumber).catch(() => null);
  const dense = fullSchedule ? denseRouteFromSchedule(fullSchedule) : undefined;
  if (dense && dense.length >= (journey.routeGeometry?.length ?? 0)) journey.routeGeometry = dense;
  return journey;
}

/** Schedule-only journey fallback; no live data exists so status is not_started. */
function buildJourneyFromSchedule(
  schedule: TrainSchedule,
  activeTrains: ActiveTrain[],
  stationCoords: Map<string, [number, number]>,
  nameUnicode?: string
): LiveJourney {
  const stations: Station[] = dropCoordOutliers(schedule.stationList.map((row, i) => {
    const c = stationCoords.get(row.stationCode);
    return {
      code: row.stationCode,
      name: row.stationName || row.stationCode,
      lat: c?.[0] ?? 0,
      lng: c?.[1] ?? 0,
      scheduledArrival: formatTime(row.arrivalTime) || '--:--',
      scheduledDeparture: formatTime(row.departureTime) || '--:--',
      delayMinutes: 0,
      distanceKm: parseDistanceKm(row.distance),
      status: i === 0 ? 'current' : 'upcoming',
    };
  }));

  const origin = stations[0];
  const destination = stations[stations.length - 1];
  const totalDistanceKm = destination?.distanceKm ?? 0;

  const routeGeometry = buildRouteGeometry(stations, null, null);

  let trainLat: number;
  let trainLng: number;
  let positionSource: LiveLocation['positionSource'];
  // This path always returns status: 'not_started' — a live-feed GPS fix for
  // the train number here would be a positioning move or feed lag, not the
  // journey actually running, so origin-station coordinates are what's true.
  if (origin?.lat && origin?.lng) {
    trainLat = origin.lat;
    trainLng = origin.lng;
    positionSource = 'station';
  } else if (routeGeometry && routeGeometry.length >= 2) {
    const [lng, lat] = interpolatePolyline(routeGeometry, 0);
    trainLng = lng;
    trainLat = lat;
    positionSource = 'projected';
  } else {
    trainLat = 0;
    trainLng = 0;
    positionSource = 'none';
  }

  const departs = origin?.scheduledDeparture && origin.scheduledDeparture !== '--:--'
    ? `${origin.name} at ${origin.scheduledDeparture}`
    : null;

  return {
    trainId: schedule.trainNumber,
    number: schedule.trainNumber,
    name: schedule.trainName || schedule.trainNumber,
    nameUnicode,
    origin: { code: origin?.code ?? schedule.stationFrom, name: origin?.name ?? schedule.stationFrom },
    destination: { code: destination?.code ?? schedule.stationTo, name: destination?.name ?? schedule.stationTo },
    currentLocation: { lat: trainLat, lng: trainLng, heading: 45, speedKmh: 0, isMoving: false, positionSource },
    status: 'not_started',
    delayMinutes: 0,
    speedKmh: 0,
    distanceCoveredKm: 0,
    remainingDistanceKm: totalDistanceKm,
    totalDistanceKm,
    completionPercentage: 0,
    lastUpdated: new Date().toISOString(),
    ETA: departs ? `Departs ${departs}` : 'Not running today',
    currentStation: origin,
    nextStation: stations[1],
    stations,
    routeGeometry,
  };
}
