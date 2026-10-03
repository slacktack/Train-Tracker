import { NextResponse } from 'next/server';
import { currentFeedSource, getActiveTrains, isFeedStale } from '@/lib/railjournal';

export const dynamic = 'force-dynamic';

/**
 * Compact live feed of all active trains for the home-page map.
 * Fields are trimmed server-side to keep the payload small (~1500 trains).
 * On origin failure the lib serves the last-known snapshot with stale:true
 * so the map never blanks out.
 */
export async function GET() {
  try {
    const trains = await getActiveTrains();
    return NextResponse.json({
      count: trains.length,
      stale: isFeedStale(),
      source: currentFeedSource(),
      trains: trains.map((t) => ({
        n: t.train_no,
        name: t.train_name,
        type: t.train_type,
        lat: t.lat,
        lon: t.lon,
        src: t.source,
        h: t.heading ?? 0,
        stn: t.station_name ?? undefined,
        stc: t.station_code ?? undefined,
        st: t.start_date,
        spd: t.speedKmh ?? 0,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[active-trains] feed fetch failed:', message);
    return NextResponse.json({ error: 'Failed to fetch active trains' }, { status: 502 });
  }
}
