'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ApiError, getJSON } from '@/lib/client-api';
import type { AlternativesResponse } from '@/lib/combos-types';
import { formatDay } from '@/lib/format';
import { useT } from '@/lib/i18n/useT';
import { useStationName } from '@/lib/i18n/stationNames';
import { useStationIndex } from '@/lib/useStationIndex';
import { EmptyState, ErrorState, GlassCard, Skeleton } from '@/components/ui/kit';
import { ComboList } from './ComboList';

// Trains for a route the traveller chose themselves: From, stops in between, To.
export function RoutePlan({ stops, date, quota }: { stops: string[]; date: string; quota: string }) {
  const { t, lang } = useT();
  const local = useStationName();
  const { search } = useStationIndex();
  const name = (code: string) => local(code, search(code, 1)[0]?.code === code ? search(code, 1)[0].name : code);

  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ['route', stops.join('>'), date, quota],
    queryFn: ({ signal }) => getJSON<AlternativesResponse>(`/api/trains/route?stops=${stops.join(',')}&date=${date}&quota=${quota}`, signal),
    staleTime: 3 * 60_000,
    retry: 0,
  });

  const emptyLeg = data?.legCounts?.findIndex((n) => n === 0) ?? -1;

  return (
    <section className="mt-6" aria-live="polite" aria-label={t('via.route')}>
      <p className="text-caption font-semibold text-ink-muted">{t('via.route')}</p>
      <p className="mt-0.5 break-words text-subhead font-bold leading-snug">{stops.map((c) => name(c)).join('  →  ')}</p>
      <p className="mb-4 mt-1 text-caption text-ink-muted">
        {formatDay(date, lang)} · {t('via.legs', { n: stops.length - 1 })} · {t(`trains.quota.${quota}` as 'trains.quota.GN')}
      </p>

      {isFetching && !data && (
        <div role="status" className="space-y-3">
          <p className="text-caption font-semibold text-ink-muted">{t('via.searching')}</p>
          {[0, 1].map((i) => (
            <GlassCard key={i} className="space-y-3 p-4">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </GlassCard>
          ))}
        </div>
      )}
      {error && !data && <ErrorState message={error instanceof ApiError ? error.message : t('common.somethingWrong')} onRetry={() => refetch()} />}
      {data && data.combos.length === 0 && (
        <EmptyState
          title={emptyLeg >= 0 ? t('via.legNone', { a: name(stops[emptyLeg]), b: name(stops[emptyLeg + 1]) }) : t('via.none')}
          hint={emptyLeg >= 0 ? t('via.legNoneHint') : t('via.noneHint')}
        />
      )}
      {data && data.combos.length === 0 && data.suggestions && data.suggestions.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-body font-bold">{t('via.try')}</p>
          <div className="flex flex-wrap gap-2">
            {data.suggestions.map((sg) => {
              const next = stops.map((c, i) => (i === sg.stopIndex ? sg.code : c));
              const middle = next.slice(1, -1);
              const href = `/trains?from=${next[0]}&to=${next[next.length - 1]}${middle.length ? `&via=${middle.join(',')}` : ''}&date=${date}&quota=${quota}`;
              return (
                <Link key={sg.code} href={href} className="cta-lamp inline-flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-body font-bold">
                  {local(sg.code, sg.name)} <span className="text-caption font-semibold opacity-70">{t('via.trainsOn', { n: sg.trains })}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
      {data && <ComboList combos={data.combos} quota={quota} />}
    </section>
  );
}
