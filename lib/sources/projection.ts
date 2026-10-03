import type { ActiveTrain } from '@/types/train';

// Row shape of RailRadar /legacy/trains/live-map.
export interface RadarRow {
  train_number: string;
  train_name: string;
  type: string;
  mins_since_dep: number;
  current_station: string;
  current_station_name: string;
  current_lat: number;
  current_lng: number;
  departure_minutes: number;
  current_day: number;
  next_station: string | null;
  next_station_name: string | null;
  next_lat: number | null;
  next_lng: number | null;
  next_arrival_minutes: number | null;
  curr_distance: number;
  next_distance: number | null;
}

const TYPE_CODES: Record<string, string> = {
  'vande bharat express': 'VNDB',
  'amrit bharat express': 'AMTB',
  'rajdhani express': 'RAJ',
  'jan shatabdi express': 'JSH',
  'shatabdi express': 'SHT',
  'humsafar express': 'SUF',
  'parcel express': 'PEXP',
  'garib rath express': 'GBR',
  'tourist train': 'TOD',
  'duronto express': 'DRNT',
  'tejas express': 'TEJ',
  'mail/express': 'MEX',
  'superfast express': 'SUF',
  memu: 'MEMU',
  passenger: 'PAS',
  emu: 'EMU',
  suburban: 'SUB',
  'train on demand': 'TOD',
  demu: 'DMU',
  dmu: 'DMU',
};

const MAX_SPEED: Record<string, number> = {
  VNDB: 130, RAJ: 110, SHT: 110, TEJ: 110, DRNT: 110, JSH: 100, GBR: 90, AMTB: 100,
  SUF: 100, MEX: 90, PEXP: 80, TOD: 80, PAS: 70, MEMU: 80, DMU: 70, SUB: 80, EMU: 80,
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const IST_MS = 5.5 * 3600_000;

export function radarTypeCode(type: string): string {
  return TYPE_CODES[type.trim().toLowerCase()] ?? 'MEX';
}

export function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(r(lon2 - lon1)) * Math.cos(r(lat2));
  const x = Math.cos(r(lat1)) * Math.sin(r(lat2)) - Math.sin(r(lat1)) * Math.cos(r(lat2)) * Math.cos(r(lon2 - lon1));
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
}

function istMinuteOfDay(ms: number): number {
  const d = new Date(ms + IST_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function istDateParts(ms: number): { day: number; month: number } {
  const d = new Date(ms + IST_MS);
  return { day: d.getUTCDate(), month: d.getUTCMonth() };
}

function istStamp(ms: number): string {
  return new Date(ms + IST_MS).toISOString().slice(0, 19).replace('T', ' ');
}

// Linear projection from the last-reached station toward the next one.
export function projectRow(row: RadarRow, snapshotAt: number, now: number): ActiveTrain {
  const code = radarTypeCode(row.type);
  const startMs = snapshotAt - row.mins_since_dep * 60_000;
  const { day, month } = istDateParts(startMs);
  const base: ActiveTrain = {
    train_no: row.train_number,
    train_name: row.train_name,
    train_type: code,
    start_date: `${String(day).padStart(2, '0')} ${MONTHS[month]}`,
    actual_time: istStamp(snapshotAt),
    lat: row.current_lat,
    lon: row.current_lng,
    source: 'STATION',
    gps_time: istStamp(snapshotAt),
    station_code: row.current_station,
    station_name: row.current_station_name,
    heading: 0,
    speedKmh: 0,
  };

  const { next_lat: nLat, next_lng: nLng, next_arrival_minutes: nArr, next_distance: nDist } = row;
  if (row.next_station == null || nLat == null || nLng == null || nArr == null || nDist == null) return base;

  const heading = bearing(row.current_lat, row.current_lng, nLat, nLng);
  const segKm = Math.max(0.1, nDist - row.curr_distance);
  const snapMin = istMinuteOfDay(snapshotAt);
  const delta = (nArr - snapMin + 1440) % 1440;
  const elapsed = Math.max(0, (now - snapshotAt) / 60_000);
  const remaining = delta - elapsed;
  const vmax = MAX_SPEED[code] ?? 80;

  if (remaining <= 0) {
    return { ...base, lat: nLat, lon: nLng, heading, station_code: row.next_station, station_name: row.next_station_name ?? row.next_station };
  }

  const implied = delta > 0 ? (segKm / delta) * 60 : vmax;
  const speed = Math.max(10, Math.min(vmax, implied));
  const remainingKm = Math.min(segKm, (remaining * speed) / 60);
  const progress = 1 - remainingKm / segKm;
  const moving = progress > 0.02;
  return {
    ...base,
    lat: row.current_lat + (nLat - row.current_lat) * progress,
    lon: row.current_lng + (nLng - row.current_lng) * progress,
    source: moving ? 'GPS' : 'STATION',
    heading,
    speedKmh: moving ? Math.round(speed) : 0,
    station_code: progress < 0.5 ? row.current_station : row.next_station,
    station_name: progress < 0.5 ? row.current_station_name : (row.next_station_name ?? row.next_station),
  };
}

export function projectRows(rows: RadarRow[], snapshotAt: number, now: number): ActiveTrain[] {
  const out: ActiveTrain[] = [];
  for (const row of rows) {
    if (!Number.isFinite(row.current_lat) || !Number.isFinite(row.current_lng)) continue;
    out.push(projectRow(row, snapshotAt, now));
  }
  return out;
}
