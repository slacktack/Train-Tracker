import { NextResponse } from 'next/server';
import { radarStatus } from '@/lib/sources/railradar';

export const dynamic = 'force-dynamic';

export function GET() {
  const radar = radarStatus();
  return NextResponse.json({
    ok: true,
    radar: { ...radar, ageMin: radar.fetchedAt ? Math.round((Date.now() - radar.fetchedAt) / 60_000) : null },
  });
}
