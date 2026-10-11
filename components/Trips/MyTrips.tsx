'use client';

import Link from 'next/link';
import { Bell, Building2, CalendarDays, Radio, Route, Ticket, Utensils, X } from 'lucide-react';
import { ecateringUrl } from '@/lib/booking';
import { daysFromToday, formatDay } from '@/lib/format';
import { useT } from '@/lib/i18n/useT';
import { useStationName } from '@/lib/i18n/stationNames';
import { isPnrExpired, maskPnr, useRecentPnrStore, type RecentPnr } from '@/store/useRecentsExtras';
import { useAlarmStore } from '@/store/useAlarmStore';

type Trip = RecentPnr & { trainNo: string; doj: string };

export function upcomingTrips(pnrs: RecentPnr[], now = Date.now()): Trip[] {
  return pnrs
    .filter((p): p is Trip => !!p.trainNo && !!p.doj && !isPnrExpired(p, now))
    .sort((a, b) => a.doj.localeCompare(b.doj));
}

// Trips are built from remembered PNRs; passenger details are never stored, so this card is safe offline.
export function MyTrips() {
  const { t, lang } = useT();
  const local = useStationName();
  const { pnrs, remove } = useRecentPnrStore();
  const alarms = useAlarmStore((s) => s.alarms);
  const trips = upcomingTrips(pnrs);
  if (trips.length === 0) return null;

  const when = (iso: string) => {
    const d = daysFromToday(iso);
    if (d === 0) return t('trip.today');
    if (d === 1) return t('trip.tomorrow');
    if (d > 1) return t('trip.inDays', { n: d });
    return '';
  };

  return (
    <section className="mt-6" aria-label={t('trip.title')}>
      <h2 className="mb-2 flex items-center gap-2 text-body font-bold">
        <CalendarDays className="h-4 w-4" aria-hidden /> {t('trip.title')}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {trips.map((p) => {
          const board = p.boarding?.code ? p.boarding : p.from;
          const alarm = alarms.find((a) => a.trainNumber === p.trainNo && !a.firedAt);
          const rel = when(p.doj);
          return (
            <li key={p.pnr} className="glass rounded-2xl p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-caption font-semibold text-ink-muted">
                    {formatDay(p.doj, lang)}
                    {rel && <span className="ml-1.5 rounded-md bg-accent/12 px-1.5 py-0.5 font-bold text-accent">{rel}</span>}
                  </p>
                  <p className="mt-1 break-words text-body font-bold">
                    <span className="font-mono">{p.trainNo}</span> {p.trainName}
                  </p>
                  {board && p.to && (
                    <p className="break-words text-caption text-ink-muted">
                      {local(board.code, board.name)} → {local(p.to.code, p.to.name)}
                      {p.travelClass ? ` · ${p.travelClass}` : ''}
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => remove(p.pnr)} aria-label={`${t('common.remove')} ${maskPnr(p.pnr)}`} className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-ink">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              {alarm && (
                <p className="mt-2 flex items-center gap-1.5 text-caption font-semibold text-status-onTime">
                  <Bell className="h-3.5 w-3.5" aria-hidden /> {t('saved.alarmLine', { station: local(alarm.stationCode, alarm.stationName), lead: alarm.leadMin })}
                </p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2 text-caption font-bold">
                <Link href={`/track/${p.trainNo}`} className="cta-lamp flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2">
                  <Radio className="h-4 w-4" aria-hidden /> {t('trip.track')}
                </Link>
                <Link href={`/pnr/${p.pnr}`} className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-ink/25 px-2 hover:bg-ink/[0.05]">
                  <Ticket className="h-4 w-4" aria-hidden /> {t('trip.pnr', { pnr: maskPnr(p.pnr) })}
                </Link>
                <Link href={`/track/${p.trainNo}?alarm=1`} className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-ink/25 px-2 hover:bg-ink/[0.05]">
                  <Bell className="h-4 w-4" aria-hidden /> {alarm ? t('trip.alarmEdit') : t('trip.alarm')}
                </Link>
                {board?.code ? (
                  <Link href={`/station/${board.code}`} className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-ink/25 px-2 hover:bg-ink/[0.05]">
                    <Building2 className="h-4 w-4" aria-hidden /> {t('trip.board')}
                  </Link>
                ) : null}
                <a href={ecateringUrl(p.trainNo, board?.code)} target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-ink/25 px-2 hover:bg-ink/[0.05]">
                  <Utensils className="h-4 w-4" aria-hidden /> {t('trip.food')}
                </a>
                {p.from && p.to && (
                  <Link href={`/trains?from=${board?.code || p.from.code}&to=${p.to.code}&date=${p.doj}`} className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-ink/25 px-2 hover:bg-ink/[0.05]">
                    <Route className="h-4 w-4" aria-hidden /> {t('trip.alternatives')}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-caption text-ink-muted">{t('trip.privacy')}</p>
    </section>
  );
}
