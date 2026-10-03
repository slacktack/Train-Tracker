'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Info, Radio } from 'lucide-react';
import { ApiError, getJSON, type SeatsResponse } from '@/lib/client-api';
import { cn } from '@/lib/cn';
import { isoDate } from '@/lib/format';
import { DateStrip } from '@/components/Search/DateStrip';
import { StationPicker, type PickedStation } from '@/components/Search/StationPicker';
import { ErrorState, GlassCard, PageShell, SectionLabel, Skeleton } from '@/components/ui/kit';
import { useT } from '@/lib/i18n/useT';
import { useGoBack } from '@/lib/useGoBack';
import { useStationIndex } from '@/lib/useStationIndex';

const CLASS_BY_PREFIX: Record<string, { label: string; color: string }> = {
  H: { label: '1A', color: '#AF52DE' },
  A: { label: '2A', color: '#0A84FF' },
  B: { label: '3A', color: '#32ADE6' },
  M: { label: '3E', color: '#32ADE6' },
  S: { label: 'SL', color: '#FF9F0A' },
  C: { label: 'CC', color: '#34C759' },
  E: { label: 'EC', color: '#30D158' },
  D: { label: '2S', color: '#FFD60A' },
  G: { label: 'GEN', color: '#8E8E93' },
  F: { label: 'FC', color: '#FF2D55' },
};

function describeCoach(name: string, classCode: string) {
  if (name === 'L') return { kind: 'engine' as const, label: 'Engine', color: '#64748B' };
  if (name === 'EOG' || /^(PC|SLR|GS|GRD)/i.test(name)) return { kind: 'service' as const, label: classCode || 'Service', color: '#64748B' };
  const c = CLASS_BY_PREFIX[name[0]?.toUpperCase()];
  return { kind: 'coach' as const, label: classCode || c?.label || '', color: c?.color ?? '#8E8E93' };
}

export function SeatsScreen({ trainNumber, station: initialStation, date: initialDate }: { trainNumber: string; station: string | null; date: string | null }) {
  const { t } = useT();
  const goBack = useGoBack(`/track/${trainNumber}`);
  const { search, ready } = useStationIndex();
  const router = useRouter();
  const [station, setStation] = useState<PickedStation | null>(initialStation ? { code: initialStation, name: initialStation } : null);
  useEffect(() => {
    if (!ready) return;
    setStation((cur) => {
      if (!cur || cur.name !== cur.code) return cur;
      const hit = search(cur.code, 1)[0];
      return hit && hit.code === cur.code ? { code: hit.code, name: hit.name } : cur;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  const [date, setDate] = useState(initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : isoDate(0));
  const [applied, setApplied] = useState(initialStation ? { station: initialStation, date } : null);

  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ['seats', trainNumber, applied?.station, applied?.date],
    queryFn: ({ signal }) => getJSON<SeatsResponse>(`/api/seats/${trainNumber}?station=${applied!.station}&date=${applied!.date}`, signal),
    enabled: !!applied,
    staleTime: 3 * 60_000,
    placeholderData: keepPreviousData,
  });

  const apply = () => {
    if (!station) return;
    setApplied({ station: station.code, date });
    router.replace(`/track/${trainNumber}/seats?station=${station.code}&date=${date}`, { scroll: false });
  };

  const hasVacancy = data?.coaches.some((c) => c.vacantBerths != null);
  const totalVacant = data?.coaches.reduce((n, c) => n + (c.vacantBerths ?? 0), 0) ?? 0;

  return (
    <PageShell>
      <div className="flex items-center justify-between pb-3 pt-3 sm:pt-6">
        <button type="button" onClick={goBack} className="flex min-h-10 items-center gap-1.5 text-body font-medium text-ink-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {t('common.back')}
        </button>
        <Link href={`/track/${trainNumber}`} className="glass flex h-10 items-center gap-1.5 rounded-pill px-3 text-caption font-semibold text-accent">
          <Radio className="h-3.5 w-3.5" aria-hidden /> {t('seats.track')}
        </Link>
      </div>
      <h1 className="font-display text-[1.75rem] font-semibold leading-8 tracking-tight">
        {t('seats.title')} <span className="font-mono text-accent">{trainNumber}</span>
      </h1>
      <p className="mt-1 text-body text-ink-muted">{t('seats.subtitle')}</p>

      <GlassCard strong className="relative z-20 mt-4 space-y-4 p-4 sm:p-5">
        <StationPicker label={t('seats.boarding')} value={station} onChange={setStation} placeholder={t('seats.boardingPlaceholder')} />
        <DateStrip value={date} onChange={setDate} />
        <button
          onClick={apply}
          disabled={!station}
          className="flex h-12 w-full items-center justify-center rounded-2xl  text-body font-semibold   transition-all active:scale-[0.98] disabled:opacity-50 cta-lamp"
        >
          {t('seats.show')}
        </button>
      </GlassCard>

      <div className="mt-5 space-y-3">
        {isFetching && !data && (
          <div role="status" aria-label={t('common.loading')} className="flex gap-2 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-16 shrink-0" />
            ))}
          </div>
        )}
        {error && !data && <ErrorState message={error instanceof ApiError ? error.message : t('common.somethingWrong')} onRetry={() => refetch()} />}

        {data && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded-pill px-3 py-1 text-caption font-semibold',
                  data.source === 'none' ? 'bg-status-minorDelay/12 text-status-minorDelay' : 'bg-status-onTime/12 text-status-onTime',
                )}
              >
                {data.source === 'irctc' ? t('seats.liveIrctc') : data.source === 'railjournal' ? t('seats.chartRj') : t('seats.layoutOnly')}
              </span>
              {hasVacancy && <span className="text-caption text-ink-muted">{t('seats.totalVacant', { n: totalVacant })}</span>}
            </div>

            <GlassCard className="p-4">
              <SectionLabel className="mb-3">{t('seats.engine', { rake: data.layout?.rake ?? '', n: data.coaches.length })}</SectionLabel>
              {data.coaches.length === 0 ? (
                <p className="text-body text-ink-muted">{t('seats.noComp')}</p>
              ) : (
                <ol className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2" aria-label="Coaches from the engine">
                  {data.coaches.map((c, i) => {
                    const d = describeCoach(c.coachName, c.classCode);
                    return (
                      <li
                        key={`${c.coachName}-${i}`}
                        className={cn(
                          'flex w-[4.25rem] shrink-0 flex-col items-center justify-between rounded-xl border border-ink/[0.08] bg-surface-raised/70 px-1.5 py-2',
                          d.kind !== 'coach' && 'opacity-70',
                        )}
                      >
                        <span className="h-1.5 w-full rounded-full" style={{ background: d.color }} aria-hidden />
                        <span className="mt-2 font-display text-subhead leading-none">{c.coachName}</span>
                        <span className="mt-1 text-caption text-ink-muted">{d.label}</span>
                        {c.vacantBerths != null ? (
                          <span className={cn('mt-2 rounded-md px-1.5 py-0.5 text-caption font-bold', c.vacantBerths > 0 ? 'bg-status-onTime/12 text-status-onTime' : 'bg-status-heavyDelay/12 text-status-heavyDelay')}>
                            {t('seats.free', { n: c.vacantBerths })}
                          </span>
                        ) : (
                          <span className="mt-2 text-caption text-ink-muted/60">—</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </GlassCard>

            {data.notes.length > 0 && (
              <GlassCard className="flex gap-3 p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                <ul className="space-y-1 text-caption text-ink-muted">
                  {data.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                  {data.source === 'none' && <li>{t('seats.needChart')}</li>}
                </ul>
              </GlassCard>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
