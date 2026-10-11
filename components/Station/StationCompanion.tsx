'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Armchair, Bell, BellRing, Building2, Radio, Utensils, Wifi } from 'lucide-react';
import { getJSON, type BoardResponse } from '@/lib/client-api';
import type { StationInfo } from '@/lib/sources/ixigo';
import { ecateringUrl } from '@/lib/booking';
import { cn } from '@/lib/cn';
import { formatDelayMin, isoDate } from '@/lib/format';
import { useT } from '@/lib/i18n/useT';
import { pickBoardRow, tripWatchId } from '@/lib/watch';
import { useWatchStore } from '@/store/useWatchStore';

// Platform count, Wi-Fi and rating from ixigo; hidden when unavailable.
export function StationFacts({ code }: { code: string }) {
  const { t } = useT();
  const { data } = useQuery({
    queryKey: ['station-info', code],
    queryFn: ({ signal }) => getJSON<{ info: StationInfo | null }>(`/api/station-info/${code}`, signal),
    staleTime: 24 * 3600_000,
    retry: 0,
  });
  const info = data?.info;
  if (!info || (!info.platformCount && info.freeWifi === null && !info.rating)) return null;
  const bits = [
    info.platformCount ? t('companion.platforms', { n: info.platformCount }) : null,
    info.freeWifi ? t('companion.wifi') : null,
    info.rating ? t('companion.rating', { n: info.rating.toFixed(1) }) : null,
  ].filter(Boolean);
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-muted">
      <Building2 className="h-3.5 w-3.5" aria-hidden />
      {bits.join(' · ')}
      {info.freeWifi && <Wifi className="h-3.5 w-3.5" aria-hidden />}
      <span className="opacity-70">· ixigo</span>
    </p>
  );
}

// "What do I need at this station?" for one train.
export function StationCompanion({ code, stationName, train }: { code: string; stationName: string; train: string }) {
  const { t, lang } = useT();
  const { watches, toggle } = useWatchStore();
  const { data, isLoading } = useQuery({
    queryKey: ['board', code, 8],
    queryFn: ({ signal }) => getJSON<BoardResponse>(`/api/board/${code}?hrs=8`, signal),
    refetchInterval: 45_000,
    staleTime: 20_000,
  });
  const row = data ? pickBoardRow(data.rows, train, isoDate(0)) : null;
  const date = row?.schDepIso?.slice(0, 10) || isoDate(0);
  const delay = row?.delayDepMin ?? row?.delayArrMin ?? null;
  const watchId = tripWatchId({ train, station: code, date });
  const watching = watches.some((w) => w.id === watchId);
  const name = row?.trainName ?? train;

  const action = 'flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-ink/25 px-2 text-caption font-bold hover:bg-ink/[0.05]';

  return (
    <section className="glass-strong mb-4 rounded-2xl p-4" aria-label={t('companion.title')}>
      <p className="text-caption font-semibold text-ink-muted">{t('companion.title')}</p>
      <h2 className="mt-0.5 break-words text-subhead font-bold">
        <span className="font-mono">{train}</span> {row?.trainName ?? ''}
      </h2>

      {isLoading && <p className="mt-2 text-caption text-ink-muted">{t('common.loading')}</p>}
      {data && !row && <p className="mt-2 text-body text-ink-muted">{t('companion.notOnBoard')}</p>}
      {row && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-ink/[0.05] p-2.5">
            <p className="text-caption text-ink-muted">{t('common.platform')}</p>
            <p className="led text-[1.6rem] leading-tight">{row.platform ?? '—'}</p>
          </div>
          <div className="rounded-xl bg-ink/[0.05] p-2.5">
            <p className="text-caption text-ink-muted">{row.schDep ? t('companion.departs') : t('companion.arrives')}</p>
            <p className="led text-[1.6rem] leading-tight">{row.actDep ?? row.schDep ?? row.actArr ?? row.schArr ?? '—'}</p>
          </div>
          <div className="rounded-xl bg-ink/[0.05] p-2.5">
            <p className="text-caption text-ink-muted">{t('companion.status')}</p>
            <p className={cn('text-body font-bold leading-tight', row.cancelled ? 'text-status-heavyDelay' : delay && delay >= 15 ? 'text-status-minorDelay' : 'text-status-onTime')}>
              {row.cancelled ? t('companion.cancelled') : formatDelayMin(delay ?? 0, lang)}
            </p>
            {row.atStation && !row.cancelled && <p className="text-caption font-semibold text-ink-muted">{t('companion.atStation')}</p>}
          </div>
        </div>
      )}
      {row && !row.platform && <p className="mt-2 text-caption text-ink-muted">{t('companion.noPlatform')}</p>}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href={`/track/${train}`} className="cta-lamp flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-caption font-bold">
          <Radio className="h-4 w-4" aria-hidden /> {t('trip.track')}
        </Link>
        <Link href={`/track/${train}/seats?station=${code}&date=${date}`} className={action}>
          <Armchair className="h-4 w-4" aria-hidden /> {t('companion.coaches')}
        </Link>
        <Link href={`/track/${train}?alarm=1`} className={action}>
          <Bell className="h-4 w-4" aria-hidden /> {t('trip.alarm')}
        </Link>
        <a href={ecateringUrl(train, code)} target="_blank" rel="noopener noreferrer" className={action}>
          <Utensils className="h-4 w-4" aria-hidden /> {t('trip.food')}
        </a>
        <button
          type="button"
          aria-pressed={watching}
          onClick={() => toggle({ kind: 'trip', id: watchId, train, trainName: name, station: code, stationName, date, lastPlatform: row?.platform ?? undefined })}
          className={cn(action, 'col-span-2', watching && 'pill-on border-ink')}
        >
          <BellRing className="h-4 w-4" aria-hidden /> {watching ? t('trip.alertsOn') : t('trip.alertsOff')}
        </button>
      </div>
    </section>
  );
}
