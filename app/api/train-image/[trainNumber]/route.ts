import { NextRequest, NextResponse } from 'next/server';
import { getTrainPhoto } from '@/lib/sources/train-photo';

/** Photo metadata for a train (Wikimedia Commons). Image bytes come from ./img so they cache locally. */
export async function GET(req: NextRequest, { params }: { params: { trainNumber: string } }) {
  if (!/^\d{5}$/.test(params.trainNumber)) return NextResponse.json({ error: 'invalid train number' }, { status: 400 });
  const photo = await getTrainPhoto(params.trainNumber, req.nextUrl.searchParams.get('type') ?? undefined);
  return NextResponse.json(
    photo
      ? { src: `/api/train-image/${params.trainNumber}/img`, credit: photo.credit, license: photo.license, pageUrl: photo.pageUrl, exact: photo.exact }
      : { src: null },
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}
