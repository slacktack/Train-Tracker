import { NextRequest } from 'next/server';
import { getTrainPhoto } from '@/lib/sources/train-photo';

const UA = 'TrainTracker/0.1 (localhost personal project)';

export async function GET(req: NextRequest, { params }: { params: { trainNumber: string } }) {
  if (!/^\d{5}$/.test(params.trainNumber)) return new Response(null, { status: 400 });
  const photo = await getTrainPhoto(params.trainNumber, req.nextUrl.searchParams.get('type') ?? undefined);
  if (!photo) return new Response(null, { status: 404 });
  const upstream = await fetch(photo.thumb, { headers: { 'User-Agent': UA } }).catch(() => null);
  if (!upstream?.ok || !upstream.body) return new Response(null, { status: 502 });
  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=604800, immutable',
    },
  });
}
