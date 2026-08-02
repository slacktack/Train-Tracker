import { NextRequest, NextResponse } from 'next/server';
import { getTrainSchedule } from '@/lib/railjournal';
import { getCached, setCached } from '@/lib/redis-cache';
import { TrainSchedule } from '@/lib/railjournal';

export async function GET(
  _req: NextRequest,
  { params }: { params: { trainNumber: string } }
) {
  const { trainNumber } = params;
  const cacheKey = `schedule:${trainNumber}`;

  try {
    const cached = await getCached<TrainSchedule>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const schedule = await getTrainSchedule(trainNumber);
    if (!schedule) {
      // 200 + null: "no data" is normal here — 404s would spam the console.
      return NextResponse.json(null);
    }
    await setCached(cacheKey, schedule, 24 * 3600);
    return NextResponse.json(schedule);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[schedule] fetch failed for ${trainNumber}:`, message);
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 502 });
  }
}
