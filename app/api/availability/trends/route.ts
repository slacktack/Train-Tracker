import { NextRequest, NextResponse } from 'next/server';
import { badRequest, cached, isIsoDate, isoToDmy, isTrainNo, upstreamFailure } from '@/lib/api';
import { getTrends, QUOTAS } from '@/lib/sources/confirmtkt';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const train = sp.get('train');
  const cls = sp.get('class')?.toUpperCase() ?? '';
  const quota = sp.get('quota')?.toUpperCase() ?? 'GN';
  const date = sp.get('date');
  if (!isTrainNo(train)) return badRequest('train must be a 5-digit number');
  if (!/^[0-9A-Z]{2}$/.test(cls)) return badRequest('class must be a 2-character class code');
  if (!(QUOTAS as readonly string[]).includes(quota)) return badRequest('invalid quota');
  if (!isIsoDate(date)) return badRequest('date must be YYYY-MM-DD');

  try {
    const points = await cached(`trends:${train}:${cls}:${quota}:${date}`, 3600, () =>
      getTrends({ trainNo: train, travelClass: cls, bookingType: quota, date: isoToDmy(date) }),
    );
    const tally = { confirmed: 0, rac: 0, waitlisted: 0, unknown: 0 };
    for (const p of points) tally[p.outcome] += 1;
    return NextResponse.json({ train, class: cls, quota, points, tally });
  } catch (err) {
    return upstreamFailure(err, 'trends');
  }
}
