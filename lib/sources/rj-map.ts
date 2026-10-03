import type { ActiveTrain } from '@/types/train';
import { bearing } from './projection';
import { getStation } from './offline';

export interface RjRow {
  train_no: string;
  train_name: string;
  train_type: string;
  start_date: string;
  actual_time: string;
  lat: number;
  lon: number;
  speed: number | null;
  projection_speed_kmh?: number | null;
  projection_epoch?: number | null;
  gps_time: string | null;
  event_type?: string;
  station_code?: string | null;
  next_station_code?: string | null;
  next_station_lat?: number | null;
  next_station_lon?: number | null;
  heading?: number | null;
}

const TYPE_ALIAS: Record<string, string> = {
  HMSF: 'SUF', AMTM: 'AMTB', AMTS: 'AMTB', MXMU: 'MEMU', MMTS: 'EMU', MXDU: 'DMU', PUJA: 'TOD',
  UDAY: 'SUF', ANTY: 'SUF', FTR: 'PEXP', UMEX: 'MEX', AIIS: 'SUF', AIIM: 'MEX', DDCK: 'MEX',
  MAMN: 'MEX', PSDU: 'DMU', SUBA: 'SUB', RPCG: 'PEXP', MISC: 'TOD', PLOW: 'PILT', BHGV: 'TOD',
};
const KNOWN = new Set(['RAJ', 'SHT', 'VNDB', 'TEJ', 'DRNT', 'JSH', 'GBR', 'AMTB', 'MEX', 'SUF', 'PEXP', 'TOD', 'PAS', 'MEMU', 'DMU', 'SUB', 'EMU', 'PILT']);

export function normalizeType(code: string): string {
  const c = (code ?? '').toUpperCase();
  const mapped = TYPE_ALIAS[c] ?? c;
  return KNOWN.has(mapped) ? mapped : 'MEX';
}

const R = 6371;
function distKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const MAX_EXTRAPOLATE_S = 180;

// Snapshot rows are already projected to ~snapshot time; nudge toward the next station until the next poll.
export function mapRjRow(row: RjRow, now: number): ActiveTrain | null {
  if (!Number.isFinite(row.lat) || !Number.isFinite(row.lon) || !row.train_no) return null;
  const speed = Math.round(row.speed ?? row.projection_speed_kmh ?? 0);
  const atStation = row.event_type === 'A';
  let lat = row.lat;
  let lon = row.lon;
  let heading = row.heading ?? 0;

  const nLat = row.next_station_lat;
  const nLon = row.next_station_lon;
  if (!atStation && speed > 5 && nLat != null && nLon != null) {
    const epochMs = (row.projection_epoch ?? 0) * 1000;
    const dtS = epochMs ? Math.min(MAX_EXTRAPOLATE_S, Math.max(0, (now - epochMs) / 1000)) : 0;
    const total = distKm(lat, lon, nLat, nLon);
    if (dtS > 0 && total > 0.05) {
      const frac = Math.min(1, ((speed * dtS) / 3600) / total);
      lat += (nLat - lat) * frac;
      lon += (nLon - lon) * frac;
    }
    if (row.heading == null) heading = bearing(row.lat, row.lon, nLat, nLon);
  }

  const code = row.station_code ?? undefined;
  return {
    train_no: row.train_no,
    train_name: row.train_name,
    train_type: normalizeType(row.train_type),
    start_date: row.start_date,
    actual_time: row.actual_time,
    lat,
    lon,
    source: atStation || speed <= 3 ? 'STATION' : 'GPS',
    gps_time: row.gps_time,
    station_code: code,
    station_name: code ? getStation(code)?.name ?? code : undefined,
    heading: Math.round(heading),
    speedKmh: atStation ? 0 : speed,
  };
}

export function mapRjRows(rows: RjRow[], now: number): ActiveTrain[] {
  const out: ActiveTrain[] = [];
  for (const r of rows) {
    const t = mapRjRow(r, now);
    if (t) out.push(t);
  }
  return out;
}
