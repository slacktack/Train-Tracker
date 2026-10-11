'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Armchair, ArrowUpRight, ChevronDown, ChevronRight, Radio, Star, Utensils } from 'lucide-react';
import type { AvailabilityTrain, ClassAvailability } from '@/lib/sources/confirmtkt';
import { cn } from '@/lib/cn';
import { formatAge, formatInr, hhmmToMin, parseUpstreamTime } from '@/lib/format';
import { OTHER_BOOKING, PRIMARY_BOOKING } from '@/lib/booking';
import { usePendingBooking } from '@/store/usePendingBooking';
import { getJSON, type TrendsResponse } from '@/lib/client-api';
import { humanMinutes } from '@/lib/where-now';
import { useT } from '@/lib/i18n/useT';
import { useStationName } from '@/lib/i18n/stationNames';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { TrendsPanel, trendsKey, trendsUrl } from './TrendsPanel';
import { OtherDates } from './OtherDates';

function niceDuration(hhmm: string, lang: 'en' | 'hi'): string {
  const m = hhmm.match(/^(\d+):(\d{2})$/);
  return m ? humanMinutes(Number(m[1]) * 60 + Number(m[2]), lang) : hhmm;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const PUNCT = {
  ok: 'bg-status-onTime/12 text-status-onTime',
  warn: 'bg-status-minorDelay/12 text-status-minorDelay',
  bad: 'bg-status-heavyDelay/12 text-status-heavyDelay',
} as const;
const punctTone = (n: number) => (n >= 7 ? 'ok' : n >= 4 ? 'warn' : 'bad');

const TILE = {
  confirm: { bar: 'bg-status-onTime', text: 'text-status-onTime' },
  probable: { bar: 'bg-status-minorDelay', text: 'text-status-minorDelay' },
  'no-chance': { bar: 'bg-status-heavyDelay', text: 'text-status-heavyDelay' },
  closed: { bar: 'bg-ink-muted/50', text: 'text-ink-muted' },
  unknown: { bar: 'bg-ink-muted/40', text: 'text-ink' },
} as const;

function ClassTile({ c, active, onSelect, onHover }: { c: ClassAvailability; active: boolean; onSelect: () => void; onHover: () => void }) {
  const tone = TILE[c.verdict];
  return (
    <button
      type="button"
      onClick={onSelect}
      onPointerEnter={onHover}
      onTouchStart={onHover}
      aria-expanded={active}
      aria-label={`${c.cls}: ${c.status}`}
      className={cn(
        'relative flex min-w-[6rem] shrink-0 flex-col items-start overflow-hidden rounded-lg border border-ink/15 bg-surface-elevated/70 py-2 pl-3.5 pr-3 text-left transition-transform active:scale-[0.97]',
        active && 'border-ink/60 shadow-glow',
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1.5', tone.bar)} aria-hidden />
      <span className="flex w-full items-baseline justify-between gap-2">
        <span className="text-subhead font-bold leading-none">{c.cls}</span>
        {c.fare && <span className="text-caption text-ink-muted">{formatInr(c.fare)}</span>}
      </span>
      <span className={cn('mt-1 text-body font-bold leading-tight', tone.text)}>{c.status}</span>
      {c.prediction && <span className="text-caption leading-tight text-ink-muted">{c.prediction}</span>}
    </button>
  );
}

// Horizontal strip with an edge fade + chevron while more classes are off-screen.
function ClassStrip({ children, label }: { children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', check);
      ro.disconnect();
    };
  }, []);
  return (
    <div className="relative -mx-1 mt-3">
      <div ref={ref} role="group" aria-label={label} className="flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
        {children}
      </div>
      {more && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() => ref.current?.scrollBy({ left: ref.current.clientWidth * 0.7, behavior: 'smooth' })}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-end bg-gradient-to-l from-surface-raised via-surface-raised/80 to-transparent pr-0.5"
        >
          <ChevronRight className="h-5 w-5 text-ink" />
        </button>
      )}
    </div>
  );
}

export function TrainResultCard({ train, date, quota, weekday, fromNote, toNote, compare, onPickDate }: { train: AvailabilityTrain; date: string; quota: string; weekday: string; fromNote?: string; toNote?: string; compare?: { selected: boolean; disabled: boolean; onToggle: () => void }; onPickDate?: (iso: string) => void }) {
  const [openClass, setOpenClass] = useState<string | null>(null);
  const [showLast, setShowLast] = useState(false);
  const { t, lang } = useT();
  const localName = useStationName();
  const qc = useQueryClient();
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const startBooking = usePendingBooking((s) => s.start);
  const fav = isFavorite(train.number);
  const overnight = hhmmToMin(train.arrival) < hhmmToMin(train.departure);
  const departed = train.departed;
  const tilesVisible = !departed || showLast;
  const checkedAt = parseUpstreamTime(train.classes.find((c) => c.cls === openClass)?.cachedAt);
  const book = PRIMARY_BOOKING.url({ from: train.from.code, to: train.to.code, date, train: train.number, cls: openClass ?? undefined, quota });

  const prefetch = (cls: string) =>
    qc.prefetchQuery({
      queryKey: trendsKey(train.number, cls, quota, date),
      queryFn: ({ signal }) => getJSON<TrendsResponse>(trendsUrl(train.number, cls, quota, date), signal),
      staleTime: 30 * 60_000,
    });

  return (
    <article className="relative [filter:drop-shadow(0_1px_1px_rgb(40_30_10/0.18))_drop-shadow(0_12px_14px_rgb(40_30_10/0.16))]" aria-label={`${train.number} ${train.name}`}>
      <div className="ticket relative flex overflow-hidden rounded-xl border border-ink/15 bg-surface-raised" style={{ ['--stub' as string]: '4.75rem' }}>
        {/* stub */}
        <div className="flex w-[4.75rem] shrink-0 flex-col items-center justify-between gap-3 bg-[#10131c] px-1.5 py-3 text-center">
          <span className="led board-text text-[1.6rem] text-[#ffb43a]" style={{ textShadow: '0 0 8px rgb(255 160 40 / .5)' }}>
            {train.number}
          </span>
          <span className="text-[0.625rem] font-semibold leading-tight text-white/55">{train.distanceKm} {t('common.km')}</span>
        </div>
        <span className="ticket-perf pointer-events-none absolute bottom-3 left-[4.75rem] top-3 w-[2px]" aria-hidden />

        {/* body */}
        <div className={cn('min-w-0 flex-1 p-3.5 pl-5 transition-opacity', departed && 'opacity-[0.78]')}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="break-words text-subhead font-bold leading-snug">{train.name}</h3>
              <div className="mt-1.5 flex items-center gap-1" aria-label={`${t('card.runsOn')} ${train.runsOn.join(', ')}`}>
                {DAYS.map((d) => {
                  const runs = train.runsOn.includes(d);
                  return (
                    <span
                      key={d}
                      className={cn(
                        'flex h-[1.15rem] w-[1.15rem] items-center justify-center rounded-[4px] text-[0.625rem] font-bold',
                        runs ? 'bg-ink text-surface-raised' : 'text-ink-muted/45',
                        d === weekday && runs && 'outline outline-2 outline-offset-1 outline-lamp',
                      )}
                    >
                      {d[0]}
                    </span>
                  );
                })}
                {train.hasPantry && <Utensils className="ml-1 h-3.5 w-3.5 text-ink-muted" aria-label={t('trains.pantry')} />}
              </div>
              {train.punctuality && (
                <p
                  className={cn('mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-caption font-bold', PUNCT[punctTone(train.punctuality.overall)])}
                  title={t('trains.punctualityHint')}
                >
                  {t('trains.punctuality', { n: train.punctuality.overall })}
                  <span className="font-medium opacity-75">· RailYatri</span>
                </p>
              )}
            </div>
            <button
              onClick={() => toggleFavorite({ number: train.number, name: train.name })}
              aria-label={fav ? t('card.removeFav') : t('card.addFav')}
              aria-pressed={fav}
              className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-ink/[0.07]"
            >
              <Star className={cn('h-5 w-5', fav && 'fill-lamp text-ink')} aria-hidden />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="min-w-0">
              <p className="led text-[1.7rem] leading-none">{train.departure}</p>
              <p className="mt-1 break-words text-caption font-medium text-ink-muted">{localName(train.from.code, train.from.name)}</p>
              {fromNote && <p className="mt-0.5 text-caption font-bold text-stamp">{fromNote}</p>}
            </div>
            <div className="flex min-w-[3.5rem] flex-1 flex-col items-center">
              <span className="text-caption font-semibold text-ink-muted">{niceDuration(train.duration, lang)}</span>
              <span className="relative my-1 h-[2px] w-full bg-ink/25">
                <span className="absolute -top-[3px] left-0 h-2 w-2 rounded-full border-2 border-ink bg-surface-raised" />
                <span className="absolute -top-[3px] right-0 h-2 w-2 rounded-full bg-ink" />
              </span>
            </div>
            <div className="min-w-0 text-right">
              <p className="led text-[1.7rem] leading-none">
                {train.arrival}
                {overnight && <sup className="ml-0.5 text-caption font-bold text-ink-muted">+1</sup>}
              </p>
              <p className="mt-1 break-words text-caption font-medium text-ink-muted">{localName(train.to.code, train.to.name)}</p>
              {toNote && <p className="mt-0.5 text-caption font-bold text-stamp">{toNote}</p>}
            </div>
          </div>

          {departed && (
            <p className="mt-3 text-caption font-medium text-ink-muted">{t('trains.departedHint', { station: localName(train.from.code, train.from.name) })}</p>
          )}

          {tilesVisible && train.classes.length > 0 && (
            <ClassStrip label={t('trains.classesFor', { n: train.classes.length })}>
              {train.classes.map((c) => (
                <ClassTile key={c.cls} c={c} active={openClass === c.cls} onHover={() => prefetch(c.cls)} onSelect={() => setOpenClass(openClass === c.cls ? null : c.cls)} />
              ))}
            </ClassStrip>
          )}
          {tilesVisible && train.classes.length === 0 && <p className="mt-3 text-caption text-ink-muted">{t('trains.noClassData')}</p>}

          {!departed && train.alternates && train.alternates.length > 0 && (
            <ul className="mt-2.5 space-y-1.5" aria-label={t('trains.splitTicket')}>
              {train.alternates.slice(0, 2).map((a) => {
                const hub = a.kind === 'split' ? a.segments[0]?.to : a.segments[0]?.from;
                return (
                  <li key={`${a.cls}-${a.kind}`} className="flex items-start gap-2 rounded-lg border border-dashed border-ink/35 px-2.5 py-2 text-caption">
                    <span className="rounded-md bg-lamp px-1.5 py-0.5 font-bold text-[#141826]">{a.cls}</span>
                    <span className="min-w-0 flex-1 break-words text-ink-muted">
                      <b className="text-ink">{a.kind === 'split' ? t('trains.splitTicket') : t('trains.nearbySeat')}</b>
                      {a.kind === 'split' ? ` · ${t('trains.splitHint', { station: localName(hub ?? '', hub ?? '') })}` : ` · ${a.segments[0]?.from} → ${a.segments[0]?.to}`}
                      {a.totalFare ? ` · ${formatInr(a.totalFare)}` : ''}
                      <span className="block font-semibold text-ink">{a.segments.map((g) => `${g.from}→${g.to} ${g.status}`).join('  +  ')}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {tilesVisible && openClass && (
            <div className="mt-2 rounded-lg border border-ink/10 bg-surface/60 px-3 pb-3">
              {checkedAt && <p className="pt-2.5 text-caption text-ink-muted">{t('trains.classChecked', { cls: openClass, age: formatAge(checkedAt, lang) })}</p>}
              {!departed && <OtherDates train={train.number} from={train.from.code} to={train.to.code} cls={openClass} quota={quota} date={date} onPick={onPickDate} />}
              <TrendsPanel train={train.number} cls={openClass} quota={quota} date={date} />
            </div>
          )}

          {/* phones: Book spans the row, the rest sit two-up; wider: one wrapped row */}
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-dashed border-ink/20 pt-3 sm:flex sm:flex-wrap sm:items-center">
            {!departed && (
              <a
                href={book}
                onClick={() => startBooking({ trainNo: train.number, trainName: train.name, from: train.from.code, to: train.to.code, date, provider: PRIMARY_BOOKING.name })}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('trains.bookAria', { provider: PRIMARY_BOOKING.name })}
                className="cta-lamp col-span-2 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3.5 text-body font-bold active:scale-[0.97]"
              >
                {t('trains.bookOn', { provider: PRIMARY_BOOKING.name })} <ArrowUpRight className="h-4 w-4" aria-hidden />
              </a>
            )}
            <Link
              href={`/track/${train.number}`}
              prefetch
              className={cn(
                'inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-caption font-bold transition-transform sm:px-3 sm:text-body',
                departed ? 'cta-lamp col-span-2 sm:col-span-1' : 'border border-ink/40 bg-surface-elevated/70 hover:bg-surface-elevated active:scale-[0.97]',
              )}
            >
              <Radio className="h-4 w-4 shrink-0" aria-hidden /> {departed ? t('trains.trackLive') : t('trains.liveStatus')}
            </Link>
            {!departed && (
              <Link
                href={`/track/${train.number}/seats?station=${train.from.code}&date=${date}`}
                prefetch={false}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-ink/25 px-2.5 text-caption font-semibold text-ink-muted transition-colors hover:text-ink active:scale-[0.97] sm:px-3 sm:text-body"
              >
                <Armchair className="h-4 w-4 shrink-0" aria-hidden /> {t('trains.seats')}
              </Link>
            )}
            {compare && !departed && (
              <button
                type="button"
                onClick={compare.onToggle}
                disabled={compare.disabled && !compare.selected}
                aria-pressed={compare.selected}
                className={cn('inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-caption font-semibold transition-colors disabled:opacity-40 sm:px-3 sm:text-body', compare.selected ? 'pill-on border-ink' : 'border-ink/25 text-ink-muted hover:text-ink')}
              >
                {t('split.compare')}
              </button>
            )}
            {departed && train.classes.length > 0 && (
              <button
                type="button"
                onClick={() => setShowLast((v) => !v)}
                aria-expanded={showLast}
                className="col-span-2 inline-flex items-center gap-1 text-caption font-semibold text-ink-muted hover:text-ink sm:ml-auto"
              >
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showLast && 'rotate-180')} aria-hidden />
                {showLast ? t('trains.hideLast') : t('trains.showLast')}
              </button>
            )}
            {!departed && train.classes.length > 0 && (
              <span className="flex items-center justify-center gap-1 text-caption text-ink-muted sm:ml-auto">
                <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden /> {t('trains.tapClass')}
              </span>
            )}
          </div>
          {!departed && (
            <p className="mt-2 text-caption text-ink-muted">
              {t('trains.alsoOn')}{' '}
              {OTHER_BOOKING.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && ' · '}
                  <a
                    href={p.url({ from: train.from.code, to: train.to.code, date, train: train.number, cls: openClass ?? undefined, quota })}
                    onClick={() => startBooking({ trainNo: train.number, trainName: train.name, from: train.from.code, to: train.to.code, date, provider: p.name })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-ink underline decoration-ink/30 underline-offset-2 hover:decoration-ink"
                  >
                    {p.name}
                  </a>
                </span>
              ))}
            </p>
          )}
        </div>
      </div>

      {departed && (
        <span
          className="pointer-events-none absolute right-12 top-2.5 -rotate-6 rounded-md border-[2.5px] border-stamp px-2 py-0.5 text-body font-extrabold uppercase tracking-widest text-stamp opacity-90 [mix-blend-mode:multiply]"
          aria-hidden
        >
          {t('trains.departed')}
        </span>
      )}
    </article>
  );
}
