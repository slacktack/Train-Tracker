import { NextRequest, NextResponse } from 'next/server';
import { getWeatherSnapshot } from '@/lib/openmeteo';

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get('lat') ?? '');
  const lng = parseFloat(req.nextUrl.searchParams.get('lng') ?? '');

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng query params are required' }, { status: 400 });
  }

  try {
    const snapshot = await getWeatherSnapshot(lat, lng);
    return NextResponse.json(snapshot);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 502 });
  }
}
