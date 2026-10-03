'use client';

import { useQuery } from '@tanstack/react-query';
import { ApiError, getJSON, type TrendsResponse } from '@/lib/client-api';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n/useT';
import { Skeleton } from '@/components/ui/kit';

export const trendsKey = (train: string, cls: string, quota: string, date: string) => ['trends', train, cls, quota, date] as const;
export const trendsUrl = (train: string, cls: string, quota: string, date: string) =>
  `/api/availability/trends?train=${train}&class=${cls}&quota=${quota}&date=${date}`;

const OUTCOME_STYLE = {
  confirmed: 'bg-status-onTime/12 text-status-onTime',
  rac: 'bg-status-minorDelay/12 text-status-minorDelay',
  waitlisted: 'bg-status-heavyDelay/12 text-status-heavyDelay',
  unknown: 'bg-ink/[0.06] text-ink-muted',
} as const;

export function TrendsPanel({ train, cls, quota, date }: { train: string; cls: string; quota: string; date: string }) {
  const { t } = useT();
  const { data, isLoading, error } = useQuery({
    queryKey: trendsKey(train, cls, quota, date),
    queryFn: ({ signal }) => getJSON<TrendsResponse>(trendsUrl(train, cls, quota, date), signal),
    staleTime: 30 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2 pt-3" aria-label={t('common.loading')}>
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (error) {
    return <p className="pt-3 text-caption text-ink-muted">{error instanceof ApiError ? error.message : t('trains.trendsError')}</p>;
  }
  if (!data || data.points.length === 0) {
    return <p className="pt-3 text-caption text-ink-muted">{t('trains.trendsEmpty', { cls, quota })}</p>;
  }

  const total = Math.max(1, data.points.length);
  const pct = (n: number) => Math.round((n / total) * 100);
  const segments = [
    { key: 'confirmed', label: t('trains.confirmed'), n: data.tally.confirmed, color: 'bg-status-onTime' },
    { key: 'rac', label: t('trains.rac'), n: data.tally.rac, color: 'bg-status-minorDelay' },
    { key: 'waitlisted', label: t('trains.waitlisted'), n: data.tally.waitlisted, color: 'bg-status-heavyDelay' },
  ] as const;

  return (
    <div className="pt-3">
      <p className="text-caption font-semibold text-ink-muted">{t('trains.trendsTitle', { n: data.points.length })}</p>
      <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-ink/[0.07]" role="img" aria-label="Outcome split">
        {segments.map((s) => (
          <span key={s.key} className={cn(s.color, 'transition-all')} style={{ width: `${pct(s.n)}%` }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-caption text-ink-muted">
            <span className={cn('h-2 w-2 rounded-full', s.color)} aria-hidden />
            {s.label} <b className="font-semibold text-ink">{pct(s.n)}%</b>
          </span>
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {data.points.slice(0, 10).map((p, i) => (
          <li key={`${p.date}-${i}`} className="flex items-center justify-between gap-2 rounded-xl bg-ink/[0.04] px-2.5 py-1.5 text-caption">
            <span className="text-ink-muted">{p.date.slice(5).split('-').reverse().join('/')}</span>
            <span className="min-w-0 flex-1 text-right text-ink-muted">{p.bookingStatus}</span>
            <span className={cn('rounded-md px-1.5 py-0.5 font-semibold', OUTCOME_STYLE[p.outcome])}>{p.finalStatus || '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
