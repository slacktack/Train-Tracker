import { NextRequest, NextResponse } from 'next/server';
import { getLiveJourney } from '@/lib/railradar';
import { getCached, setCached } from '@/lib/redis-cache';
import { LiveJourney } from '@/types/train';

export async function GET(
  _req: NextRequest,
  { params }: { params: { trainNumber: string } }
) {
  const { trainNumber } = params;
  const cacheKey = `journey:${trainNumber}`;

  try {
    const journey = await getLiveJourney(trainNumber);
    if (!journey) {
      return NextResponse.json({ error: 'Train not found' }, { status: 404 });
    }
    await setCached(cacheKey, journey, 20);
    return NextResponse.json(journey);
  } catch (err: any) {
    const isQuotaExceeded = typeof err?.message === 'string' && err.message.startsWith('QUOTA_EXCEEDED');
    const stale = await getCached<LiveJourney>(cacheKey);

    if (stale) {
      return NextResponse.json({ ...stale, stale: true });
    }
    if (isQuotaExceeded) {
      return NextResponse.json({ error: 'Rate limit exceeded, no cached data available' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Failed to fetch journey' }, { status: 502 });
  }
}
