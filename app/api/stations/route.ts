import { NextResponse } from 'next/server';
import { getActiveTrains, isFeedStale } from '@/lib/railjournal';

interface StationGroup {
  code: string;
  name: string;
  lat: number;
  lon: number;
  count: number;
  trains: Array<{
    n: string;
    name: string;
    type: string;
    lat: number;
    lon: number;
    src: 'STATION' | 'GPS';
    h: number;
    st: string;
    spd: number;
  }>;
}

/**
 * Active trains grouped by station — powers the tap-station departure board.
 * Trains reported AT a station (STATION source) carry exact coords; GPS trains
 * report their nearest station code with their own live position.
 */
export async function GET() {
  try {
    const trains = await getActiveTrains();
    const byStation = new Map<string, StationGroup>();

    for (const t of trains) {
      const code = t.station_code;
      if (!code) continue;
      const group = byStation.get(code) ?? {
        code,
        name: t.station_name ?? code,
        lat: t.lat,
        lon: t.lon,
        count: 0,
        trains: [],
      };
      if (t.source === 'STATION' && Number.isFinite(t.lat) && Number.isFinite(t.lon)) {
        group.lat = t.lat;
        group.lon = t.lon;
        group.name = t.station_name ?? group.name;
      }
      group.count += 1;
      group.trains.push({
        n: t.train_no,
        name: t.train_name,
        type: t.train_type,
        lat: t.lat,
        lon: t.lon,
        src: t.source,
        h: t.heading ?? 0,
        st: t.start_date,
        spd: t.speedKmh ?? 0,
      });
      byStation.set(code, group);
    }

    const stations = Array.from(byStation.values())
      .sort((a, b) => b.count - a.count)
      .map(({ trains: _trains, ...rest }) => ({
        ...rest,
        trains: _trains.sort((a, b) => a.n.localeCompare(b.n)).slice(0, 12),
      }));

    return NextResponse.json({
      count: stations.length,
      stale: isFeedStale(),
      stations,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[stations] aggregation failed:', message);
    return NextResponse.json({ error: 'Failed to aggregate stations' }, { status: 502 });
  }
}
