import { NextRequest, NextResponse } from 'next/server';
import { badRequest, cached, isIsoDate, isoToDmy, isStationCode, isTrainNo, upstreamFailure } from '@/lib/api';
import { getMonthlyAvailability, QUOTAS } from '@/lib/sources/confirmtkt';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const train = sp.get('train');
  const from = sp.get('from')?.toUpperCase() ?? null;
  const to = sp.get('to')?.toUpperCase() ?? null;
  const cls = sp.get('class')?.toUpperCase() ?? '';
  const quota = sp.get('quota')?.toUpperCase() ?? 'GN';
  const date = sp.get('date');
  if (!isTrainNo(train)) return badRequest('train must be a 5-digit number');
  if (!isStationCode(from) || !isStationCode(to)) return badRequest('from and to must be station codes');
  if (!/^[0-9A-Z]{2}$/.test(cls)) return badRequest('class must be a 2-character class code');
  if (!(QUOTAS as readonly string[]).includes(quota)) return badRequest('invalid quota');
  if (!isIsoDate(date)) return badRequest('date must be YYYY-MM-DD');

  try {
    const days = await cached(`monthly:${train}:${from}:${to}:${cls}:${quota}:${date}`, 1800, () =>
      getMonthlyAvailability({ train, from, to, cls, quota, date: isoToDmy(date) }),
    );
    return NextResponse.json({ train, class: cls, quota, days });
  } catch (err) {
    return upstreamFailure(err, 'monthly');
  }
}
