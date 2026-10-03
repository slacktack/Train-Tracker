import { NextRequest, NextResponse } from 'next/server';
import { badRequest, cached, isIsoDate, isoToDmy, isStationOrCity, upstreamFailure } from '@/lib/api';
import { anchorOf, cityMembers, isCity, titleCase } from '@/lib/cities';
import { searchableStations } from '@/lib/sources/offline-near';
import type { AvailabilityResult, AvailabilityTrain } from '@/lib/sources/confirmtkt';
import { getAvailabilityBest, QUOTAS, Quota } from '@/lib/sources/confirmtkt';
import { getStation } from '@/lib/sources/offline';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const from = sp.get('from')?.toUpperCase() ?? null;
  const to = sp.get('to')?.toUpperCase() ?? null;
  const date = sp.get('date');
  const quota = (sp.get('quota') ?? 'GN').toUpperCase() as Quota;
  if (!isStationOrCity(from) || !isStationOrCity(to)) return badRequest('from and to must be station codes');
  if (anchorOf(from) === anchorOf(to)) return badRequest('from and to must differ');
  if (!isIsoDate(date)) return badRequest('date must be YYYY-MM-DD');
  if (!QUOTAS.includes(quota)) return badRequest(`quota must be one of ${QUOTAS.join(', ')}`);

  const expand = (v: string): string[] => (isCity(v) ? cityMembers(searchableStations(), anchorOf(v)).slice(0, 4).map((x) => x.code) : [v]);
  const named = (v: string, raw: string | null) => {
    const st = getStation(anchorOf(v));
    if (!isCity(v)) return st ?? { code: v, name: v };
    const typed = (raw ?? '').replace(/[^A-Za-z0-9\u0900-\u097F .'-]/g, '').slice(0, 40).trim();
    return { code: v, name: `${typed ? titleCase(typed) : st?.name ?? v} (all stations)` };
  };

  try {
    const result = await cached<AvailabilityResult>(`avail3:${from}:${to}:${date}:${quota}`, 120, async () => {
      const starts = expand(from);
      const ends = expand(to);
      if (starts.length === 1 && ends.length === 1) return getAvailabilityBest({ from: starts[0], to: ends[0], date: isoToDmy(date), quota });
      // a city on either side: ask every station pair and keep each train with the stations it really uses
      const pairs = starts.flatMap((f) => ends.map((t) => ({ f, t }))).filter((x) => x.f !== x.t);
      const found: AvailabilityResult[] = [];
      let i = 0;
      await Promise.all(
        Array.from({ length: Math.min(5, pairs.length) }, async () => {
          while (i < pairs.length) {
            const { f, t } = pairs[i++];
            found.push(await getAvailabilityBest({ from: f, to: t, date: isoToDmy(date), quota }).catch(() => ({ trains: [], quotas: [], fetchedAt: null })));
          }
        }),
      );
      const seen = new Set<string>();
      const trains: AvailabilityTrain[] = [];
      for (const r of found) for (const t of r.trains) {
        const k = `${t.number}-${t.from.code}-${t.to.code}`;
        if (!seen.has(k)) {
          seen.add(k);
          trains.push(t);
        }
      }
      return { trains, quotas: found[0]?.quotas ?? [], fetchedAt: found[0]?.fetchedAt ?? null };
    });
    return NextResponse.json({ from: named(from, sp.get('fromName')), to: named(to, sp.get('toName')), date, quota, ...result });
  } catch (err) {
    return upstreamFailure(err, 'trains-between');
  }
}
