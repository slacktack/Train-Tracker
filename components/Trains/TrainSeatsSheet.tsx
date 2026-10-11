'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useDialogFocus } from '@/lib/useDialogFocus';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Radio, X } from 'lucide-react';
import { ApiError, getJSON, type BetweenResponse } from '@/lib/client-api';
import type { TrainSchedule } from '@/lib/rail-schedule-types';
import { isoDate, isoToDate } from '@/lib/format';
import { useT } from '@/lib/i18n/useT';
import { useStationName } from '@/lib/i18n/stationNames';
import { DateStrip } from '@/components/Search/DateStrip';
import { EmptyState, ErrorState, Segmented, Skeleton } from '@/components/ui/kit';
import { TrainResultCard } from './TrainResultCard';

const QUOTAS = ['GN', 'TQ', 'LD', 'SS'] as const;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface SheetTrain {
  number: string;
  name: string;
  from: { code: string; name: string };
  defaultTo: string;
  date: string;
  cancelled?: boolean;
}

// Opens from a station board: the train's seats, fares and ticket options, with live tracking one tap away.
export function TrainSeatsSheet({ train, onClose }: { train: SheetTrain; onClose: () => void }) {
  const { t } = useT();
  const local = useStationName();
  const [to, setTo] = useState(train.defaultTo);
  const [date, setDate] = useState(train.date < isoDate(0) ? isoDate(0) : train.date);
  const [quota, setQuota] = useState<(typeof QUOTAS)[number]>('GN');

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(dialog, true, onClose);

  const schedule = useQuery({
    queryKey: ['schedule', train.number],
    queryFn: ({ signal }) => getJSON<TrainSchedule>(`/api/schedule/${train.number}`, signal),
    staleTime: 24 * 3600_000,
    retry: 0,
  });

  // only stations the train reaches after this one
  const stops = useMemo(() => {
    const list = schedule.data?.stationList ?? [];
    const i = list.findIndex((s) => s.stationCode === train.from.code);
    return (i >= 0 ? list.slice(i + 1) : list).map((s) => ({ code: s.stationCode, name: s.stationName }));
  }, [schedule.data, train.from.code]);

  const dest = to || stops[stops.length - 1]?.code || '';
  const canQuery = !!dest && dest !== train.from.code;

  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ['between', train.from.code, dest, date, quota],
    queryFn: ({ signal }) => getJSON<BetweenResponse>(`/api/trains/between?from=${train.from.code}&to=${dest}&date=${date}&quota=${quota}`, signal),
    enabled: canQuery,
    staleTime: 2 * 60_000,
  });

  const found = data?.trains.find((x) => x.number === train.number) ?? null;
  const weekday = WEEKDAYS[isoToDate(date).getUTCDay()];

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={t('sheet.title')}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl sm:max-h-[90dvh] sm:rounded-2xl"
      >
        <header className="flex items-start gap-3 bg-[#10131c] px-4 py-3 text-white">
          <span className="led text-[1.6rem] text-[#ffb43a]">{train.number}</span>
          <div className="min-w-0 flex-1">
            <h2 className="break-words text-body font-bold leading-snug">{train.name}</h2>
            <p className="text-caption text-white/60">{t('sheet.board', { station: local(train.from.code, train.from.name) })}</p>
          </div>
          <button onClick={onClose} aria-label={t('common.close')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/15">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
          {train.cancelled && <p role="alert" className="rounded-lg border border-stamp px-3 py-2 text-body font-bold text-stamp">{t('sheet.cancelled')}</p>}

          <div>
            <label htmlFor="sheet-to" className="mb-1 block text-caption font-semibold text-ink-muted">{t('sheet.to')}</label>
            <select
              id="sheet-to"
              value={dest}
              onChange={(e) => setTo(e.target.value)}
              disabled={stops.length === 0}
              className="h-12 w-full rounded-2xl border border-ink/20 bg-surface-raised px-3 text-body font-semibold outline-none focus:border-ink/60"
            >
              {stops.length === 0 && <option value={train.defaultTo}>{train.defaultTo}</option>}
              {stops.map((s, i) => (
                <option key={s.code} value={s.code}>
                  {local(s.code, s.name)} ({s.code}){i === stops.length - 1 ? ` · ${t('sheet.last')}` : ''}
                </option>
              ))}
            </select>
          </div>

          <DateStrip value={date} onChange={setDate} />
          <Segmented label={t('common.quota')} value={quota} onChange={setQuota} options={QUOTAS.map((q) => ({ value: q, label: t(`trains.quota.${q}` as 'trains.quota.GN') }))} />

          {isFetching && !data && (
            <div role="status" aria-label={t('common.loading')} className="space-y-3">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-28 w-full" />
            </div>
          )}
          {error && !data && <ErrorState message={error instanceof ApiError ? error.message : t('common.somethingWrong')} onRetry={() => refetch()} />}
          {data && !found && !isFetching && (
            <div className="space-y-3">
              <EmptyState title={t('sheet.noReserved')} hint={t('sheet.noReservedHint')} />
              <Link href={`/track/${train.number}`} className="cta-lamp flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-body font-bold">
                <Radio className="h-4 w-4" aria-hidden /> {t('trains.liveStatus')}
              </Link>
            </div>
          )}
          {found && <TrainResultCard train={found} date={date} quota={quota} weekday={weekday} />}
        </div>
      </div>
    </div>
  );
}
