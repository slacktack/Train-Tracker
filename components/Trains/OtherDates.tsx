'use client';

import { useQuery } from '@tanstack/react-query';
import { getJSON } from '@/lib/client-api';
import type { DayAvailability } from '@/lib/sources/confirmtkt';
import { cn } from '@/lib/cn';
import { formatChip, daysFromToday } from '@/lib/format';
import { useT } from '@/lib/i18n/useT';

const TONE = {
  confirm: 'text-status-onTime',
  probable: 'text-status-minorDelay',
  'no-chance': 'text-status-heavyDelay',
  closed: 'text-ink-muted',
  unknown: 'text-ink',
} as const;

const SHOW = 10;

// The same train and class on the following days, from ConfirmTkt's month view.
export function OtherDates({ train, from, to, cls, quota, date, onPick }: { train: string; from: string; to: string; cls: string; quota: string; date: string; onPick?: (iso: string) => void }) {
  const { t, lang } = useT();
  const { data, isLoading } = useQuery({
    queryKey: ['monthly', train, from, to, cls, quota, date],
    queryFn: ({ signal }) =>
      getJSON<{ days: DayAvailability[] }>(`/api/availability/monthly?train=${train}&from=${from}&to=${to}&class=${cls}&quota=${quota}&date=${date}`, signal),
    staleTime: 30 * 60_000,
    retry: 0,
  });
  const days = (data?.days ?? []).filter((d) => d.date !== date).slice(0, SHOW);
  if (isLoading) return <p className="pt-3 text-caption text-ink-muted">{t('dates.loading')}</p>;
  if (days.length === 0) return null;

  return (
    <section className="pt-3" aria-label={t('dates.title', { cls })}>
      <p className="text-caption font-semibold text-ink-muted">{t('dates.title', { cls })}</p>
      <div className="-mx-1 mt-1.5 flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar">
        {days.map((d) => {
          const chip = formatChip(d.date, daysFromToday(d.date), lang);
          const body = (
            <>
              <span className="block text-[0.6875rem] font-semibold text-ink-muted">
                {chip.top} {chip.bottom}
              </span>
              <span className={cn('block text-caption font-bold', TONE[d.verdict])}>{d.status}</span>
              {d.prediction && <span className="block text-[0.6875rem] text-ink-muted">{d.prediction}</span>}
            </>
          );
          const cls_ = 'min-w-[5.25rem] shrink-0 rounded-lg border border-ink/15 bg-surface-elevated/70 px-2 py-1.5 text-left';
          return onPick ? (
            <button key={d.date} type="button" onClick={() => onPick(d.date)} className={cn(cls_, 'hover:border-ink/40 active:scale-[0.97]')}>
              {body}
            </button>
          ) : (
            <div key={d.date} className={cls_}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}
