import { NextResponse } from 'next/server';
import { getTrainImage } from '@/lib/railjournal';
import { getCached, setCached } from '@/lib/redis-cache';

/** Train photo URL (Railfans gallery). Cached 24h — images rarely change. */
export async function GET(
  _req: Request,
  { params }: { params: { trainNumber: string } }
) {
  const { trainNumber } = params;
  const cacheKey = `train-image:${trainNumber}`;

  const cached = await getCached<{ imageUrl: string } | null>(cacheKey);
  if (cached) {
    return NextResponse.json(cached.imageUrl ? cached : { imageUrl: null });
  }

  try {
    const imageUrl = await getTrainImage(trainNumber);
    await setCached(cacheKey, { imageUrl }, 86_400);
    return NextResponse.json({ imageUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[train-image] fetch failed for ${trainNumber}:`, message);
    return NextResponse.json({ imageUrl: null });
  }
}
