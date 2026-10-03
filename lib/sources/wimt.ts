import { randomUUID } from 'crypto';
import { fetchJson, UpstreamError } from './http';

const BASE = 'https://whereismytrain.in';
const APP_VERSION = '7.1.5.931836696';
const UA = 'Dalvik/2.1.0 (Linux; U; Android 16; sdk_gphone64_arm64 Build/BE2A.250530.026.F3)';

export function adler32(input: string): number {
  const bytes = Buffer.from(input, 'utf8');
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

type Params = Record<string, string>;

// wid = adler32(user + appVersion + qid + request-specific suffix), no separators.
export function signParams(p: Params, suffix: string): Params {
  const wid = adler32((p.user ?? '') + (p.appVersion ?? '') + (p.qid ?? '') + suffix);
  return { ...p, wid: String(wid) };
}

function baseParams(): Params {
  return {
    user: randomUUID().replace(/-/g, ''),
    appVersion: APP_VERSION,
    lang: 'en',
    sb_version: '0',
    qid: randomUUID().replace(/-/g, ''),
  };
}

export function buildLiveUrl(opts: { trainNo: string; from?: string; to?: string; date: string }): string {
  const from = opts.from ?? '';
  const to = opts.to ?? '';
  const p: Params = { ...baseParams(), train_no: opts.trainNo, date: opts.date, from_day: '1', flow: 'regular' };
  if (from) p.from = from;
  if (to) p.to = to;
  const signed = signParams(p, opts.trainNo + from + to + opts.date + '1');
  return `${BASE}/cache/live_status?${new URLSearchParams(signed)}`;
}

export function buildStationUrl(code: string, hrs: number): string {
  const p: Params = { ...baseParams(), station_code: code, hrs: String(hrs) };
  const signed = signParams(p, code + hrs);
  return `${BASE}/cache/live_station?${new URLSearchParams(signed)}`;
}

const headers = { 'User-Agent': UA, 'Accept-Encoding': 'gzip' };

export interface WimtStop {
  station_code: string;
  sno: number;
  lat?: number;
  lng?: number;
  stops?: boolean;
  distance?: number;
  platform?: string;
  sch_arrival_time?: string;
  sch_departure_time?: string;
  actual_arrival_time?: string;
  actual_departure_time?: string;
  delay_in_arrival?: number;
  delay_in_departure?: number;
  departed?: boolean;
  sch_arrival_date?: string;
  sch_departure_date?: string;
  actual_arrival_date?: string;
  actual_departure_date?: string;
  sch_arrival_tm?: number;
  sch_departure_tm?: number;
}

export interface WimtLive {
  train_name?: string;
  train_type?: string;
  start_date?: string;
  source_station?: string;
  destination_station?: string;
  curStn?: string;
  last_station?: string;
  delay?: number;
  lat?: number;
  lng?: number;
  distance?: number;
  curStnDistance?: number;
  departed?: boolean;
  departedCurStn?: boolean;
  running_status?: string;
  lastUpdated?: string;
  lastUpdateIsoDate?: string;
  classes?: string[];
  days_schedule?: WimtStop[];
}

export async function getWimtLive(opts: { trainNo: string; from?: string; to?: string; date: string }): Promise<WimtLive> {
  const json = await fetchJson<WimtLive>('wimt', buildLiveUrl(opts), { headers, timeoutMs: 15_000 });
  if (!json || !Array.isArray(json.days_schedule)) throw new UpstreamError('wimt', 'unexpected live_status payload');
  return json;
}

export interface BoardRow {
  trainNo: string;
  trainName: string;
  trainType: string;
  from: string;
  to: string;
  startDate: string;
  schArr: string | null;
  schDep: string | null;
  schDepIso: string | null;
  actArr: string | null;
  actDep: string | null;
  delayArrMin: number | null;
  delayDepMin: number | null;
  platform: string | null;
  haltMin: number | null;
  cancelled: boolean;
  diverted: boolean;
  atStation: boolean;
  arrived: boolean;
  curStn: string | null;
  isSource: boolean;
  isTerminus: boolean;
}

interface RawBoardRow {
  train_no: string;
  train_name?: string;
  train_type?: string;
  source_station?: string;
  destination_station?: string;
  startDate?: string;
  scheduled_arrival?: string;
  scheduled_departure?: string;
  actArr?: string;
  actDep?: string;
  delay_in_arrival?: string;
  delay_in_departure?: string;
  platform?: string;
  schHalt?: string;
  cancelled?: boolean;
  diverted?: boolean;
  dep_cur_stn?: boolean;
  arrived?: boolean;
  cur_stn?: string;
}

// "RIGHT TIME" -> 0, "06:35" (hh:mm late) -> 395, blank -> null.
export function parseDelay(v: string | undefined): number | null {
  if (!v) return null;
  if (/right time/i.test(v)) return 0;
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function hhmm(iso: string | undefined): string | null {
  const m = iso?.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : null;
}

function actTime(v: string | undefined): string | null {
  const m = v?.match(/^(\d{1,2}:\d{2})/);
  return m ? m[1].padStart(5, '0') : null;
}

export function parseBoard(raw: { live_station_info?: RawBoardRow[]; modified_at?: string }, station: string): { rows: BoardRow[]; modifiedAt: string | null } {
  const rows = (raw.live_station_info ?? []).map<BoardRow>((r) => {
    const isSource = r.scheduled_arrival === 'Source';
    const isTerminus = r.scheduled_departure === 'Destination' || r.destination_station === station;
    const halt = Number(r.schHalt);
    return {
      trainNo: r.train_no,
      trainName: (r.train_name ?? r.train_no).replace(/\s+/g, ' ').trim(),
      trainType: r.train_type === 'MAIL/EXPRESS' ? 'MEX' : (r.train_type ?? 'MEX'),
      from: r.source_station ?? '',
      to: r.destination_station ?? '',
      startDate: r.startDate ?? '',
      schArr: isSource ? null : hhmm(r.scheduled_arrival),
      schDep: hhmm(r.scheduled_departure),
      schDepIso: r.scheduled_departure?.includes('T') ? r.scheduled_departure : null,
      actArr: actTime(r.actArr),
      actDep: actTime(r.actDep),
      delayArrMin: parseDelay(r.delay_in_arrival),
      delayDepMin: parseDelay(r.delay_in_departure),
      platform: r.platform && r.platform !== '*' && r.platform !== '0' ? r.platform : null,
      haltMin: Number.isFinite(halt) ? halt : null,
      cancelled: !!r.cancelled,
      diverted: !!r.diverted,
      atStation: r.cur_stn === station && !r.dep_cur_stn,
      arrived: !!r.arrived,
      curStn: r.cur_stn ?? null,
      isSource,
      isTerminus,
    };
  });
  return { rows, modifiedAt: raw.modified_at ?? null };
}

export async function getWimtBoard(code: string, hrs = 4) {
  const raw = await fetchJson<{ live_station_info?: RawBoardRow[]; modified_at?: string }>('wimt', buildStationUrl(code, hrs), { headers, timeoutMs: 15_000 });
  if (!raw || !Array.isArray(raw.live_station_info)) throw new UpstreamError('wimt', 'unexpected live_station payload');
  return parseBoard(raw, code);
}
