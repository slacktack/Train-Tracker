import stationsRaw from '@/data/stations.json';
import aliasesRaw from '@/data/station-aliases.json';
import trainsRaw from '@/data/trains.json';
import coachRaw from '@/data/coach-layouts.json';
import { buildStationIndex, normText, scoreMatch, searchStationIndex } from '@/lib/station-search';

export interface OfflineStation {
  code: string;
  name: string;
  lat: number;
  lng: number;
  pop: number;
}

export interface OfflineTrain {
  number: string;
  name: string;
  type: string;
  pop: number;
}

type StationRow = [string, string, number, number, number];
type TrainRow = [string, string, string, number];

const aliases = aliasesRaw as Record<string, string[]>;
const stations: OfflineStation[] = (stationsRaw as StationRow[]).map(([code, name, lat, lng, pop]) => ({ code, name, lat, lng, pop }));
const trains: OfflineTrain[] = (trainsRaw as TrainRow[]).map(([number, name, type, pop]) => ({ number, name, type, pop }));
const byCode = new Map(stations.map((s) => [s.code, s]));
const norm = normText;
const stationIndex = buildStationIndex(stationsRaw as StationRow[], aliases);
const trainIndex = trains.map((t) => ({ t, n: norm(t.name) }));

export function getStation(code: string): OfflineStation | undefined {
  return byCode.get(code.toUpperCase());
}

export function stationCoordMap(): Map<string, [number, number]> {
  return new Map(stations.filter((s) => s.lat && s.lng).map((s) => [s.code, [s.lat, s.lng]]));
}

export function searchStations(query: string, limit = 8): OfflineStation[] {
  return searchStationIndex(stationIndex, query, limit);
}

export function searchOfflineTrains(query: string, limit = 12): OfflineTrain[] {
  const q = norm(query);
  if (!q) return [];
  const isNum = /^\d+$/.test(q);
  return trainIndex
    .map(({ t, n }) => ({ t, sc: isNum ? (t.number === q ? 100 : t.number.startsWith(q) ? 60 : 0) : scoreMatch(q, '', n) }))
    .filter((x) => x.sc > 0)
    .sort((x, y) => y.sc - x.sc || y.t.pop - x.t.pop || x.t.number.localeCompare(y.t.number))
    .slice(0, limit)
    .map((x) => x.t);
}

export function getOfflineTrain(number: string): OfflineTrain | undefined {
  return trains.find((t) => t.number === number);
}

export function getCoachLayout(trainNo: string): { rake: string; coaches: string[] } | null {
  return (coachRaw as Record<string, { rake: string; coaches: string[] }>)[trainNo] ?? null;
}
