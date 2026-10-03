import { NextRequest, NextResponse } from 'next/server';
import { badRequest, cached, isIsoDate, isStationCode, upstreamFailure } from '@/lib/api';
import { QUOTAS, Quota } from '@/lib/sources/confirmtkt';
import { findCombos } from '@/lib/sources/combos';
import type { AlternativesResponse } from '@/lib/combos-types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const from = sp.get('from')?.toUpperCase() ?? null;
  const to = sp.get('to')?.toUpperCase() ?? null;
  const date = sp.get('date');
  const quota = (sp.get('quota') ?? 'GN').toUpperCase() as Quota;
  if (!isStationCode(from) || !isStationCode(to) || from === to) return badRequest('from and to must be two different station codes');
  if (!isIsoDate(date)) return badRequest('date must be YYYY-MM-DD');
  if (!(QUOTAS as readonly string[]).includes(quota)) return badRequest('invalid quota');

  try {
    const body = await cached<AlternativesResponse>(`alt:connect:${from}:${to}:${date}:${quota}`, 180, async () => {
      const { combos, searched } = await findCombos(from, to, date, quota);
      return { mode: 'connect', combos, searched };
    });
    return NextResponse.json(body);
  } catch (err) {
    return upstreamFailure(err, 'alternatives');
  }
}
