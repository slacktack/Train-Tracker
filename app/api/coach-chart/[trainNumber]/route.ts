import { NextRequest, NextResponse } from 'next/server';
import { getCoachChart, CoachChart } from '@/lib/railjournal';
import { getCached, setCached } from '@/lib/redis-cache';

export async function GET(
  req: NextRequest,
  { params }: { params: { trainNumber: string } }
) {
  const { trainNumber } = params;
  const station = req.nextUrl.searchParams.get('station') ?? '';
  const date = req.nextUrl.searchParams.get('date') ?? '';
  if (!station || !date) {
    return NextResponse.json({ error: 'station and date query params required' }, { status: 400 });
  }

  const cacheKey = `coach-chart:${trainNumber}:${station}:${date}`;

  try {
    const cached = await getCached<CoachChart>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const chart = await getCoachChart(trainNumber, station, date);
    if (!chart) {
      // 200 + null: "no chart" is normal — 404s would spam the console.
      return NextResponse.json(null);
    }
    await setCached(cacheKey, chart, 10 * 60);
    return NextResponse.json(chart);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[coach-chart] fetch failed for ${trainNumber}:`, message);
    return NextResponse.json({ error: 'Failed to fetch coach chart' }, { status: 502 });
  }
}
