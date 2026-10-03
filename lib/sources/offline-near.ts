import stationsRaw from '@/data/stations.json';
import type { OfflineStation } from './offline';

let all: OfflineStation[] | null = null;
export function searchableStations(): OfflineStation[] {
  all ??= (stationsRaw as Array<[string, string, number, number, number]>).map(([code, name, lat, lng, pop]) => ({ code, name, lat, lng, pop }));
  return all;
}
