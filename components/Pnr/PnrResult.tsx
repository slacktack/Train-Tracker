'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Armchair, ArrowLeft, Ban, Clock, Radio, RefreshCcw, Route, Share2, Train } from 'lucide-react';
import { ApiError, getJSON, type PnrResult } from '@/lib/client-api';
import { cn } from '@/lib/cn';
import { formatDay, seatTone, toIsoDate } from '@/lib/format';
import { useRecentPnrStore } from '@/store/useRecentsExtras';
import { Chip, EmptyState, ErrorState, GlassCard, PageShell, SectionLabel, Skeleton } from '@/components/ui/kit';
import { useT } from '@/lib/i18n/useT';
import { useGoBack } from '@/lib/useGoBack';
import { useStationName } from '@/lib/i18n/stationNames';

const TONE_CLASS = {
  ok: 'bg-status-onTime/12 text-status-onTime',
  warn: 'bg-status-minorDelay/12 text-status-minorDelay',
  bad: 'bg-status-heavyDelay/12 text-status-heavyDelay',
  none: 'bg-ink/[0.06] text-ink-muted',
} as const;

function Stat({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <p className="text-caption font-semibold text-ink-muted">{label}</p>
      <p className="break-words text-body font-semibold">{value}</p>
    </div>
  );
}

export function PnrResultScreen({ pnr }: { pnr: string }) {
  const { t, lang } = useT();
  const goBack = useGoBack('/pnr');
  const local = useStationName();
  const push = useRecentPnrStore((s) => s.push);
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['pnr', pnr],
    queryFn: ({ signal }) => getJSON<PnrResult>(`/api/pnr/${pnr}`, signal),
    staleTime: 60_000,
    retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 1,
  });

  useEffect(() => {
    if (data) push({ pnr, trainName: data.trainName });
  }, [data, pnr, push]);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `PNR ${pnr}`, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      // user cancelled
    }
  };

  const iso = toIsoDate(data?.doj);

  return (
    <PageShell>
      <div className="flex items-center justify-between pb-3 pt-3 sm:pt-6">
        <button type="button" onClick={goBack} className="flex min-h-10 items-center gap-1.5 text-body font-medium text-ink-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {t('common.back')}
        </button>
        <div className="flex items-center gap-1">
          <button onClick={share} aria-label={t('common.share')} className="glass flex h-10 w-10 items-center justify-center rounded-full">
            <Share2 className="h-4 w-4" aria-hidden />
          </button>
          <button onClick={() => refetch()} aria-label={t('common.refresh')} className="glass flex h-10 w-10 items-center justify-center rounded-full">
            <RefreshCcw className={cn('h-4 w-4', isFetching && 'animate-spin')} aria-hidden />
          </button>
        </div>
      </div>

      <h1 className="font-display text-[1.75rem] font-semibold leading-8 tracking-tight">
        PNR <span className="font-mono tracking-wider">{pnr}</span>
      </h1>

      <div className="mt-4 space-y-3">
        {isLoading && (
          <div role="status" aria-label={t('common.loading')} className="space-y-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {error instanceof ApiError && error.status === 404 && (
          <EmptyState
            title={t('pnr.notFound')}
            hint={t('pnr.notFoundHint')}
            action={
              <Link href="/pnr" className="mt-2 rounded-pill  px-4 py-2 text-body font-semibold cta-lamp">
                {t('pnr.another')}
              </Link>
            }
          />
        )}
        {error && !(error instanceof ApiError && error.status === 404) && (
          <ErrorState message={error instanceof ApiError ? error.message : t('common.somethingWrong')} provider={error instanceof ApiError ? error.provider : undefined} onRetry={() => refetch()} />
        )}

        {data && (
          <>
            {data.cancelled && (
              <GlassCard role="alert" className="flex items-center gap-3 border-status-heavyDelay/40 bg-status-heavyDelay/10 p-4">
                <Ban className="h-5 w-5 shrink-0 text-status-heavyDelay" aria-hidden />
                <p className="text-body font-semibold text-status-heavyDelay">{t('pnr.cancelledTrain')}</p>
              </GlassCard>
            )}
            <GlassCard strong className="p-4 sm:p-5">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="rounded-md bg-accent/12 px-1.5 py-0.5 font-mono text-caption font-bold text-accent">{data.trainNo}</span>
                <span className="font-display text-subhead">{data.trainName}</span>
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="min-w-0">
                  <p className="font-display text-[1.5rem] font-semibold leading-none">{data.departure || '—'}</p>
                  <p className="mt-1 break-words text-caption text-ink-muted">{local(data.boarding.code || data.from.code, data.boarding.name || data.from.name)}</p>
                  <p className="font-mono text-caption text-ink-muted/70">{data.boarding.code || data.from.code}</p>
                </div>
                <div className="flex min-w-[3rem] flex-1 flex-col items-center">
                  <Train className="h-4 w-4 text-accent" aria-hidden />
                  <span className="my-1 h-px w-full bg-ink/15" />
                  <span className="text-caption text-ink-muted">{data.duration}</span>
                </div>
                <div className="min-w-0 text-right">
                  <p className="font-display text-[1.5rem] font-semibold leading-none">{data.arrival || '—'}</p>
                  <p className="mt-1 break-words text-caption text-ink-muted">{local(data.to.code, data.to.name)}</p>
                  <p className="font-mono text-caption text-ink-muted/70">{data.to.code}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink/[0.06] pt-4 sm:grid-cols-4">
                <Stat label={t('pnr.journey')} value={iso ? formatDay(iso, lang) : data.doj} />
                <Stat label={t('common.class')} value={data.travelClass} />
                <Stat label={t('common.quota')} value={data.quota} />
                <Stat label={t('common.platform')} value={data.platform} />
                <Stat label={t('pnr.coachPosition')} value={data.coachPosition} />
                <Stat label={t('pnr.fare')} value={data.fare ? `₹${new Intl.NumberFormat('en-IN').format(data.fare)}` : ''} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Chip tone={data.chartPrepared ? 'ok' : 'warn'}>
                  <Clock className="h-3.5 w-3.5" aria-hidden /> {data.chartPrepared ? t('pnr.chartPrepared') : t('pnr.chartNotPrepared')}
                </Chip>
              </div>
              {data.info && <p className="mt-3 text-caption text-ink-muted">{data.info}</p>}
            </GlassCard>

            <section aria-label={t('pnr.passengers')}>
              <SectionLabel className="mb-2">{t('pnr.passengers')} · {data.passengers.length}</SectionLabel>
              {data.passengers.length === 0 && <p className="text-body text-ink-muted">{t('pnr.noPassengers')}</p>}
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.passengers.map((p) => {
                  const tone = seatTone(p.currentStatus || p.bookingStatus);
                  return (
                    <li key={p.number} className="glass flex items-center gap-3 rounded-2xl p-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/12 font-display font-semibold text-accent">{p.number}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-caption text-ink-muted">{t('pnr.booked')}: {p.bookingStatus || '-'}</p>
                        <p className="break-words text-body font-semibold">{[p.coach, p.berth].filter(Boolean).join(' · ') || t('pnr.noSeat')}</p>
                        {p.prediction && <p className="text-caption text-ink-muted">{p.prediction}</p>}
                      </div>
                      <span className={cn('shrink-0 rounded-lg px-2.5 py-1 text-caption font-bold', TONE_CLASS[tone])}>{p.currentStatus || p.bookingStatus || '—'}</span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <div className="flex flex-wrap gap-2 pt-1">
              <Link href={`/track/${data.trainNo}`} className="contents">
                <Chip tone="accent" className="px-3 py-2">
                  <Radio className="h-3.5 w-3.5" aria-hidden /> {t('pnr.trackTrain')}
                </Chip>
              </Link>
              {iso && data.boarding.code && (
                <Link href={`/track/${data.trainNo}/seats?station=${data.boarding.code}&date=${iso}`} className="contents">
                  <Chip className="px-3 py-2">
                    <Armchair className="h-3.5 w-3.5" aria-hidden /> {t('pnr.coachSeats')}
                  </Chip>
                </Link>
              )}
              {iso && (
                <Link href={`/trains?from=${data.from.code}&to=${data.to.code}&date=${iso}`} className="contents">
                  <Chip className="px-3 py-2">
                    <Route className="h-3.5 w-3.5" aria-hidden /> {t('pnr.otherTrains')}
                  </Chip>
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
