import { NextRequest, NextResponse } from 'next/server';
import { getTrainImage } from '@/lib/railjournal';
import { getCached, setCached } from '@/lib/redis-cache';

/**
 * Streams the train photo bytes through our origin instead of pointing the
 * browser at railjournal.in directly — hotlink protection (Referer checks)
 * blocks cross-origin <img> loads, so proxying server-side with the right
 * headers is the only way photos reliably render.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { trainNumber: string } }
) {
  const { trainNumber } = params;
  const cacheKey = `train-image:${trainNumber}`;

  let imageUrl: string | null = null;
  const cached = await getCached<{ imageUrl: string | null }>(cacheKey);
  if (cached?.imageUrl) {
    imageUrl = cached.imageUrl;
  } else {
    try {
      imageUrl = await getTrainImage(trainNumber);
      await setCached(cacheKey, { imageUrl }, 86_400);
    } catch {
      imageUrl = null;
    }
  }

  if (!imageUrl) {
    return new NextResponse(null, { status: 404 });
  }

  const res = await fetch(imageUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Referer: 'https://www.railjournal.in/',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    return new NextResponse(null, { status: 502 });
  }
  const bytes = await res.arrayBuffer();
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'image/webp',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
