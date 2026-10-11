import { randomUUID } from 'crypto';
import { fetchJson, UpstreamError } from './http';
import { getStation } from './offline';
import type { Punctuality } from './railyatri';

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Safari/537.36';

export const QUOTAS = ['GN', 'TQ', 'LD', 'SS'] as const;
export type Quota = (typeof QUOTAS)[number];

export interface ClassAvailability {
  cls: string;
  status: string;
  raw: string;
  prediction: string;
  predictionPct: number | null;
  verdict: 'confirm' | 'probable' | 'no-chance' | 'closed' | 'unknown';
  fare: number | null;
  cachedAt: string | null;
}

export interface AvailabilityTrain {
  number: string;
  name: string;
  from: { code: string; name: string };
  to: { code: string; name: string };
  departure: string;
  arrival: string;
  duration: string;
  distanceKm: number;
  runsOn: string[];
  hasPantry: boolean;
  /** Left the boarding station already; booking for it is closed. */
  departed: boolean;
  classes: ClassAvailability[];
  /** Ways to get a seat when the direct ticket is waitlisted: split the ticket, or board nearby. */
  alternates?: SeatAlternate[];
  // On-time rating from RailYatri, merged in by the route.
  punctuality?: Punctuality;
}

export interface AltSegment {
  trainNumber: string;
  from: string;
  to: string;
  cls: string;
  status: string;
  fare: number | null;
  date: string;
}

export interface SeatAlternate {
  cls: string;
  kind: 'split' | 'nearby';
  totalFare: number | null;
  segments: AltSegment[];
}

export interface AvailabilityResult {
  trains: AvailabilityTrain[];
  /** Trains from stations near the origin or destination (only when ConfirmTkt offers them). */
  nearby?: Array<{ train: AvailabilityTrain; fromCode: string; toCode: string; fromKm: number; toKm: number }>;
  quotas: string[];
  fetchedAt: string | null;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const DAY_KEYS = ['runningMon', 'runningTue', 'runningWed', 'runningThu', 'runningFri', 'runningSat', 'runningSun'] as const;

interface RawAvail {
  TravelClass: string;
  Availability?: string;
  AvailabilityDisplayName?: string;
  Prediction?: string;
  PredictionDisplayName?: string;
  ConfirmTktStatus?: string;
  Fare?: string | number;
  CacheTime?: string;
}

interface RawAvailTrain {
  trainNumber: string;
  trainName: string;
  fromStnCode: string;
  toStnCode: string;
  fromStnName?: string | null;
  toStnName?: string | null;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  distance: number;
  HasPantry?: boolean;
  isDeparted?: boolean;
  avlClasses?: { Array?: string[] };
  avaiblitycache?: Record<string, RawAvail>;
  avaiblitycacheTq?: Record<string, RawAvail>;
  [key: string]: unknown;
}

export function verdictOf(status: string | undefined): ClassAvailability['verdict'] {
  if (status === 'Confirm') return 'confirm';
  if (status === 'Probable') return 'probable';
  if (status === 'No Chance') return 'no-chance';
  return 'unknown';
}

const CLOSED_RE = /train\s*departed|no more booking|chart\s*prepared|booking closed/i;

// Raw ConfirmTkt strings -> what a passenger would say. "CURR_AVL 17" is a current-booking seat count.
export function humanizeStatus(raw: string): string {
  const v = raw.trim();
  if (!v) return 'Unavailable';
  if (/train\s*departed/i.test(v)) return 'Departed';
  if (/no more booking|booking closed/i.test(v)) return 'Booking closed';
  if (/chart\s*prepared/i.test(v)) return 'Chart prepared';
  let m = v.match(/^(?:CURR_AVL|AVAILABLE)\s*-?\s*(\d+)/i);
  if (m) return `AVL ${Number(m[1])}`;
  m = v.match(/^(RLWL|GNWL|PQWL|RSWL|TQWL|RLGN|CKWL|WL)\s*(\d+)/i);
  if (m) return `WL ${Number(m[2])}`;
  if (/^not available$/i.test(v) || /^regret/i.test(v)) return 'Not available';
  return v.replace(/_/g, ' ').replace(/\s+/g, ' ');
}

function istNow(): { iso: string; min: number } {
  const d = new Date(Date.now() + 5.5 * 3600_000);
  return { iso: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

function toMin(hhmm: string): number {
  const m = hhmm?.match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : Number.MAX_SAFE_INTEGER;
}

function mapClass(cls: string, a: RawAvail | undefined): ClassAvailability {
  const pred = a?.PredictionDisplayName ?? a?.Prediction ?? '';
  const pct = pred.match(/(\d{1,3})%/);
  const fare = Number(a?.Fare);
  const rawText = a?.AvailabilityDisplayName ?? a?.Availability ?? '';
  const closed = CLOSED_RE.test(rawText) || CLOSED_RE.test(pred);
  return {
    cls,
    status: humanizeStatus(rawText),
    raw: a?.Availability ?? '',
    prediction: closed || /^available$/i.test(pred) ? '' : pred,
    predictionPct: pct ? Number(pct[1]) : null,
    verdict: closed ? 'closed' : verdictOf(a?.ConfirmTktStatus),
    fare: Number.isFinite(fare) && fare > 0 ? fare : null,
    cachedAt: a?.CacheTime ?? null,
  };
}

export function parseAvailability(json: { trainBtwnStnsList?: RawAvailTrain[]; quotaList?: string[]; timeStamp?: string; errorMessage?: string | null }, journeyIso?: string): AvailabilityResult {
  const list = json.trainBtwnStnsList ?? [];
  const now = istNow();
  const trains = list.map<AvailabilityTrain>((t) => {
    const cache = { ...(t.avaiblitycache ?? {}), ...(t.avaiblitycacheTq ?? {}) };
    const order = t.avlClasses?.Array ?? Object.keys(cache);
    const classes = order.map((cls) => mapClass(cls, cache[cls]));
    const from = getStation(t.fromStnCode);
    const to = getStation(t.toStnCode);
    // The flag is authoritative; the clock check covers cached payloads that lag behind.
    const pastDeparture = journeyIso === now.iso && toMin(t.departureTime) < now.min - 2;
    const allClosed = classes.length > 0 && classes.every((c) => c.verdict === 'closed');
    return {
      number: t.trainNumber,
      name: String(t.trainName ?? '').replace(/\s+/g, ' ').trim(),
      from: { code: t.fromStnCode, name: t.fromStnName ?? from?.name ?? t.fromStnCode },
      to: { code: t.toStnCode, name: t.toStnName ?? to?.name ?? t.toStnCode },
      departure: t.departureTime,
      arrival: t.arrivalTime,
      duration: t.duration,
      distanceKm: Number(t.distance) || 0,
      runsOn: DAY_KEYS.flatMap((k, i) => (t[k] === 'Y' ? [DAYS[i]] : [])),
      hasPantry: !!t.HasPantry,
      departed: t.isDeparted === true || pastDeparture || allClosed,
      classes,
    };
  });
  return { trains, quotas: json.quotaList ?? [...QUOTAS], fetchedAt: json.timeStamp ?? null };
}

function dmyToIso(d: string): string {
  const [dd, mm, yyyy] = d.split('-');
  return `${yyyy}-${mm}-${dd}`;
}

/** ConfirmTkt words an empty route several ways: "No trains found", "No direct trains found....". */
export const isNoTrains = (m: string) => /\bno\b.*\btrains?\b/i.test(m);

export async function getAvailability(opts: { from: string; to: string; date: string; quota: Quota }): Promise<AvailabilityResult> {
  const qs = new URLSearchParams({
    fromStnCode: opts.from,
    destStnCode: opts.to,
    doj: opts.date,
    token: '',
    quota: opts.quota,
    locale: 'en',
    androidid: randomUUID(),
    travelClassOrdering: 'OFF',
    appVersion: '343',
    getTatkalCache: 'false',
    prevBookedTrains: 'OFF',
  });
  const json = await fetchJson<Parameters<typeof parseAvailability>[0]>(
    'confirmtkt',
    `https://securedapi.confirmtkt.com/api/platform/trainbooking/tatwnstns?${qs}`,
    { headers: { 'User-Agent': CHROME_UA } },
  );
  if (json.errorMessage) {
    if (isNoTrains(String(json.errorMessage))) return { trains: [], quotas: [...QUOTAS], fetchedAt: json.timeStamp ?? null };
    throw new UpstreamError('confirmtkt', String(json.errorMessage));
  }
  return parseAvailability(json, dmyToIso(opts.date));
}

export interface TrendPoint {
  date: string;
  bookingStatus: string;
  finalStatus: string;
  outcome: 'confirmed' | 'rac' | 'waitlisted' | 'unknown';
}

export function outcomeOf(s: string): TrendPoint['outcome'] {
  const v = s.trim().toUpperCase();
  if (v.startsWith('CNF') || v.startsWith('AVL')) return 'confirmed';
  if (v.startsWith('RAC')) return 'rac';
  if (v.includes('WL')) return 'waitlisted';
  return 'unknown';
}

export async function getTrends(opts: { trainNo: string; travelClass: string; bookingType: string; date: string }): Promise<TrendPoint[]> {
  const qs = new URLSearchParams({
    trainNo: opts.trainNo,
    travelClass: opts.travelClass,
    bookingType: opts.bookingType,
    dateOfJourney: opts.date,
    locale: 'en',
  });
  let json: unknown;
  try {
    json = await fetchJson<unknown>('confirmtkt', `https://api.confirmtkt.com/api/trains/trends?${qs}`, { headers: { 'User-Agent': CHROME_UA } });
  } catch (err) {
    // Class not offered on the train comes back as HTTP 500.
    if (err instanceof UpstreamError && err.status === 500) return [];
    throw err;
  }
  const rows = findArray(json);
  return rows.map<TrendPoint>((r) => {
    const rec = r as Record<string, unknown>;
    const booking = String(rec.BookingStatus ?? '').replace(/\s+/g, ' ').trim();
    const final = String(rec.ChartingStatus ?? '').replace(/\s+/g, ' ').trim();
    return {
      date: String(rec.DateOfJourney ?? '').slice(0, 10),
      bookingStatus: booking,
      finalStatus: final,
      outcome: outcomeOf(final),
    };
  });
}

function findArray(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') {
    for (const v of Object.values(json as Record<string, unknown>)) {
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') return v;
    }
    for (const v of Object.values(json as Record<string, unknown>)) {
      if (v && typeof v === 'object') {
        const inner = findArray(v);
        if (inner.length) return inner;
      }
    }
  }
  return [];
}

export interface PnrPassenger {
  number: number;
  bookingStatus: string;
  currentStatus: string;
  coach: string;
  berth: string;
  prediction: string;
}

export interface PnrResult {
  pnr: string;
  trainNo: string;
  trainName: string;
  doj: string;
  quota: string;
  travelClass: string;
  from: { code: string; name: string };
  to: { code: string; name: string };
  boarding: { code: string; name: string };
  departure: string;
  arrival: string;
  duration: string;
  platform: string;
  chartPrepared: boolean;
  cancelled: boolean;
  fare: number | null;
  coachPosition: string;
  passengers: PnrPassenger[];
  info: string;
}

interface RawPnr {
  data?: { pnrResponse?: Record<string, unknown> };
}

const str = (v: unknown): string => (v == null ? '' : String(v));

function mapPassenger(raw: unknown, i: number): PnrPassenger {
  const p = raw as Record<string, unknown>;
  const coach = str(p.CurrentCoachId ?? p.Coach ?? p.coach);
  const berth = str(p.CurrentBerthNo ?? p.Berth ?? p.berth);
  const code = str(p.CurrentBerthCode ?? '');
  return {
    number: Number(p.Number ?? p.number ?? i + 1),
    bookingStatus: str(p.BookingStatus ?? p.bookingStatus),
    currentStatus: str(p.CurrentStatus ?? p.currentStatus),
    coach: coach === '0' ? '' : coach,
    berth: berth === '0' ? '' : [berth, code].filter(Boolean).join(' '),
    prediction: str(p.Prediction ?? p.PredictionDisplayName ?? ''),
  };
}

export function parsePnr(json: RawPnr, pnr: string): PnrResult {
  const r = json.data?.pnrResponse;
  if (!r) throw new UpstreamError('confirmtkt', 'unexpected PNR payload');
  if (r.error || !r.trainNo) {
    throw new UpstreamError('confirmtkt', str(r.error) || 'PNR not found', 404);
  }
  const station = (code: unknown, name: unknown) => ({
    code: str(code),
    name: str(name) || getStation(str(code))?.name || str(code),
  });
  const fare = Number(r.ticketFare ?? r.bookingFare);
  const passengers = Array.isArray(r.passengerStatus) ? (r.passengerStatus as unknown[]).map(mapPassenger) : [];
  return {
    pnr,
    trainNo: str(r.trainNo),
    trainName: str(r.trainName),
    doj: str(r.doj),
    quota: str(r.quota),
    travelClass: str(r.class),
    from: station(r.from, r.sourceName),
    to: station(r.to, r.destinationName),
    boarding: station(r.boardingPoint, r.boardingStationName),
    departure: str(r.departureTime),
    arrival: str(r.arrivalTime),
    duration: str(r.duration),
    platform: str(r.expectedPlatformNo),
    chartPrepared: !!r.chartPrepared,
    cancelled: !!r.trainCancelledFlag,
    fare: Number.isFinite(fare) && fare > 0 ? fare : null,
    coachPosition: str(r.coachPosition),
    passengers,
    info: str(r.informationMessage),
  };
}

export async function getPnr(pnr: string): Promise<PnrResult> {
  const qs = new URLSearchParams({ querysource: 'ct-web', locale: 'en', getHighChanceText: 'false', livePnr: 'false' });
  const json = await fetchJson<RawPnr>('confirmtkt', `https://cttrainsapi.confirmtkt.com/api/v2/ctpro/mweb/${pnr}?${qs}`, {
    method: 'POST',
    headers: {
      Accept: '*/*',
      ClientId: 'ct-web',
      ApiKey: 'ct-web!2$',
      DeviceId: randomUUID(),
      Origin: 'https://www.confirmtkt.com',
      Referer: 'https://www.confirmtkt.com/',
      'Content-Type': 'application/json',
      'User-Agent': CHROME_UA,
    },
    body: JSON.stringify({ proPlanName: 'CP1', emailId: '', tempToken: '' }),
  });
  return parsePnr(json, pnr);
}


// ─── v1 search: direct + nearby + split-ticket alternates in one call ────────

interface V1Avail {
  travelClass?: string;
  availability?: string;
  availabilityDisplayName?: string;
  prediction?: string;
  predictionDisplayName?: string;
  predictionPercentage?: number | null;
  confirmTktStatus?: string;
  fare?: string | number;
  cacheTime?: string;
}

interface V1Segment {
  availabilityDisplayName?: string;
  trainNumber: string;
  source: string;
  destination: string;
  travelClass: string;
  fare?: number;
  journeyDate?: string;
}

interface V1Alt {
  segments: V1Segment[];
  type?: string;
  subType?: string;
  totalFare?: number;
}

interface V1Train {
  trainNumber: string;
  trainName: string;
  fromStnCode: string;
  toStnCode: string;
  fromStnName?: string | null;
  toStnName?: string | null;
  departureTime: string;
  arrivalTime: string;
  duration: number;
  distance: number;
  runningDays?: string;
  hasPantry?: boolean;
  hasDeparted?: boolean;
  avlClassesSorted?: string[];
  avlClasses?: string[];
  availabilityCache?: Record<string, V1Avail>;
  availabilityCacheTatkal?: Record<string, V1Avail>;
  newAlternates?: Record<string, V1Alt>;
  distanceFromSource?: number;
  distanceFromDestination?: number;
}

interface V1Response {
  data?: { trainList?: V1Train[]; nearbyTrains?: V1Train[]; quotaList?: string[]; errorMessage?: string | null };
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

function mapV1(t: V1Train, quota: Quota): AvailabilityTrain {
  const cache = quota === 'TQ' && t.availabilityCacheTatkal && Object.keys(t.availabilityCacheTatkal).length ? t.availabilityCacheTatkal : (t.availabilityCache ?? {});
  const order = t.avlClassesSorted?.length ? t.avlClassesSorted : (t.avlClasses ?? Object.keys(cache));
  const toRaw = (a: V1Avail): RawAvail => ({
    TravelClass: a.travelClass ?? '',
    Availability: a.availability,
    AvailabilityDisplayName: a.availabilityDisplayName,
    Prediction: a.prediction,
    PredictionDisplayName: a.predictionDisplayName,
    ConfirmTktStatus: a.confirmTktStatus,
    Fare: a.fare,
    CacheTime: a.cacheTime,
  });
  const classes = order.filter((c) => cache[c]).map((c) => mapClass(c, toRaw(cache[c])));
  const days = (t.runningDays ?? '').padEnd(7, '0');
  const alternates: SeatAlternate[] = [];
  for (const [cls, alt] of Object.entries(t.newAlternates ?? {})) {
    const split = alt.subType === 'AVL_STMP' && alt.segments.length > 1;
    const nearby = alt.type === 'NearbyStation' && alt.segments.length === 1;
    if (!split && !nearby) continue;
    alternates.push({
      cls,
      kind: split ? 'split' : 'nearby',
      totalFare: alt.totalFare ?? null,
      segments: alt.segments.map((g) => ({
        trainNumber: g.trainNumber,
        from: g.source,
        to: g.destination,
        cls: g.travelClass,
        status: humanizeStatus(g.availabilityDisplayName ?? ''),
        fare: g.fare ?? null,
        date: (g.journeyDate ?? '').slice(0, 10),
      })),
    });
  }
  return {
    number: t.trainNumber,
    name: String(t.trainName ?? '').replace(/\s+/g, ' ').trim(),
    from: { code: t.fromStnCode, name: t.fromStnName ?? getStation(t.fromStnCode)?.name ?? t.fromStnCode },
    to: { code: t.toStnCode, name: t.toStnName ?? getStation(t.toStnCode)?.name ?? t.toStnCode },
    departure: t.departureTime,
    arrival: t.arrivalTime,
    duration: hhmm(Number(t.duration) || 0),
    distanceKm: Number(t.distance) || 0,
    runsOn: DAYS.filter((_, i) => days[i] === '1'),
    hasPantry: !!t.hasPantry,
    departed: !!t.hasDeparted,
    classes,
    alternates: alternates.length ? alternates : undefined,
  };
}

/** One call for direct trains, nearby-station trains and split-ticket alternates. Dates are DD-MM-YYYY. */
export async function searchV1(opts: { from: string; to: string; date: string; quota: Quota }): Promise<AvailabilityResult> {
  const qs = new URLSearchParams({
    sourceStationCode: opts.from,
    destinationStationCode: opts.to,
    addAvailabilityCache: 'true',
    excludeMultiTicketAlternates: 'false',
    excludeBoostAlternates: 'false',
    sortBy: 'DEFAULT',
    dateOfJourney: opts.date,
    enableNearby: 'true',
    showPredictionGlobal: 'true',
    showNewAlternates: 'true',
    showNewAltText: 'true',
  });
  const json = await fetchJson<V1Response>('confirmtkt', `https://cttrainsapi.confirmtkt.com/api/v1/trains/search?${qs}`, {
    headers: { 'User-Agent': CHROME_UA, Accept: 'application/json' },
    timeoutMs: 15_000,
  });
  const d = json.data;
  if (!d) throw new UpstreamError('confirmtkt', 'unexpected search payload');
  const trains = (d.trainList ?? []).map((t) => mapV1(t, opts.quota));
  const nearby = (d.nearbyTrains ?? []).map((t) => ({
    train: mapV1(t, opts.quota),
    fromCode: t.fromStnCode,
    toCode: t.toStnCode,
    fromKm: t.distanceFromSource ?? 0,
    toKm: t.distanceFromDestination ?? 0,
  }));
  return { trains, nearby: nearby.length ? nearby : undefined, quotas: d.quotaList ?? [...QUOTAS], fetchedAt: new Date().toISOString() };
}

/** Best available source: v1 for General/Tatkal, the older endpoint for Ladies/Senior (or if v1 fails). */
export async function getAvailabilityBest(opts: { from: string; to: string; date: string; quota: Quota }): Promise<AvailabilityResult> {
  if (opts.quota === 'GN' || opts.quota === 'TQ') {
    try {
      const res = await searchV1(opts);
      if (res.trains.length > 0 || (res.nearby?.length ?? 0) > 0) return res;
    } catch {
      // fall through to the older endpoint
    }
  }
  try {
    return await getAvailability(opts);
  } catch (err) {
    if (err instanceof UpstreamError && isNoTrains(err.message)) return { trains: [], quotas: [...QUOTAS], fetchedAt: null };
    throw err;
  }
}

// ─── one train/class over the next 31 days ───────────────────────────────────

export interface DayAvailability {
  date: string;
  status: string;
  prediction: string;
  verdict: ClassAvailability['verdict'];
  cachedAt: string | null;
}

interface RawMonthDay {
  Doj?: string;
  CurrentStatus?: string;
  Prediction?: string;
  ConfirmTktStatus?: string;
  CacheTime?: string;
  Error?: string | null;
}

export function parseMonthly(json: unknown, cls: string): DayAvailability[] {
  if (!Array.isArray(json)) return [];
  const out: DayAvailability[] = [];
  for (const row of json as Array<Record<string, RawMonthDay>>) {
    const d = row?.[cls];
    const date = d?.Doj?.slice(0, 10);
    if (!d || !date || d.Error) continue;
    // "RLWL62/WL46": the part after the slash is the current position.
    const current = (d.CurrentStatus ?? '').split('/').pop() ?? '';
    const c = mapClass(cls, { TravelClass: cls, AvailabilityDisplayName: current, Availability: d.CurrentStatus, Prediction: d.Prediction, ConfirmTktStatus: d.ConfirmTktStatus, CacheTime: d.CacheTime });
    out.push({ date, status: c.status, prediction: c.prediction, verdict: c.verdict, cachedAt: c.cachedAt });
  }
  return out;
}

/** Dates are DD-MM-YYYY. */
export async function getMonthlyAvailability(opts: { train: string; from: string; to: string; date: string; cls: string; quota: string }): Promise<DayAvailability[]> {
  const qs = new URLSearchParams({
    source: opts.from,
    destination: opts.to,
    doj: opts.date,
    travelclasses: opts.cls,
    quota: opts.quota,
    enableTG: 'false',
    tGPlan: '',
    showTGPrediction: 'false',
    email: '',
  });
  const json = await fetchJson<unknown>('confirmtkt', `https://api.confirmtkt.com/api/trains/${opts.train}/monthlyavailability?${qs}`, {
    headers: { 'User-Agent': CHROME_UA, Accept: 'application/json', Origin: 'https://www.confirmtkt.com' },
    timeoutMs: 12_000,
  });
  return parseMonthly(json, opts.cls);
}
