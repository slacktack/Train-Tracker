import { NextRequest, NextResponse } from 'next/server';
import { badRequest, cached, isIsoDate, isStationCode, upstreamFailure } from '@/lib/api';
import { QUOTAS, Quota } from '@/lib/sources/confirmtkt';
import { planRoute } from '@/lib/sources/combos';
import type { AlternativesResponse } from '@/lib/combos-types';

export const dynamic = 'force-dynamic';

// A route the traveller chose: From, one to four stops in between, To.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const stops = (sp.get('stops') ?? '').toUpperCase().split(',').filter(Boolean);
  const date = sp.get('date');
  const quota = (sp.get('quota') ?? 'GN').toUpperCase() as Quota;
  if (stops.length < 3 || stops.length > 6 || !stops.every((s) => isStationCode(s))) return badRequest('stops must be 3 to 6 station codes');
  if (stops.some((s, i) => i > 0 && s === stops[i - 1])) return badRequest('neighbouring stops must differ');
  if (!isIsoDate(date)) return badRequest('date must be YYYY-MM-DD');
  if (!(QUOTAS as readonly string[]).includes(quota)) return badRequest('invalid quota');

  try {
    const body = await cached<AlternativesResponse>(`route:${stops.join('>')}:${date}:${quota}`, 180, async () => {
      const { combos, legCounts, searched, suggestions } = await planRoute(stops, date, quota);
      return { mode: 'route', combos, legCounts, searched, suggestions };
    });
    return NextResponse.json(body);
  } catch (err) {
    return upstreamFailure(err, 'route');
  }
}
