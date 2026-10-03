'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, RefreshCcw, SlidersHorizontal, Star, X } from 'lucide-react';
import type { LiveTrain } from '@/types/train';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n/useT';
import { useCountUp } from '@/lib/useCountUp';
import { sortTrainTypes, trainTypeColor, trainTypeLabel } from '@/lib/train-type';
import { DEFAULT_FILTERS, type MapFilters } from '@/components/Home/MapFilterBar';
import type { SavedTrain } from '@/store/useFavoritesStore';

interface HomePanelProps {
  trains: LiveTrain[];
  visible: LiveTrain[];
  filters: MapFilters;
  onFilters: (f: MapFilters) => void;
  onRefresh: () => void;
  refreshing: boolean;
  stale: boolean;
  favorites: SavedTrain[];
  onOpenTrain: (n: string) => void;
  clock: string | null;
  hideTrigger?: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const nf = new Intl.NumberFormat('en-IN');

function LedReadout({ label, value, unit, tone = 'amber' }: { label: string; value: string; unit?: string; tone?: 'amber' | 'green' }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.6875rem] font-medium leading-none text-white/55">{label}</p>
      <p className={cn('led mt-1 text-[1.6rem]', tone === 'green' && 'board-green')}>
        {value}
        {unit && <span className="ml-1 text-[0.95rem] opacity-70">{unit}</span>}
      </p>
    </div>
  );
}

function PanelBody({ trains, visible, filters, onFilters, onRefresh, refreshing, stale, favorites, onOpenTrain, clock }: HomePanelProps) {
  const { t, lang } = useT();
  const total = trains.length;
  const shown = visible.length;
  const rolled = useCountUp(shown);

  const stats = useMemo(() => {
    const gps = visible.filter((x) => x.src === 'GPS').length;
    const withSpeed = visible.filter((x) => (x.spd ?? 0) > 0);
    const avg = withSpeed.length ? Math.round(withSpeed.reduce((s, x) => s + (x.spd ?? 0), 0) / withSpeed.length) : 0;
    const fastest = withSpeed.reduce<LiveTrain | null>((b, x) => (!b || (x.spd ?? 0) > (b.spd ?? 0) ? x : b), null);
    return { movingPct: visible.length ? Math.round((gps / visible.length) * 100) : 0, avg, fastest };
  }, [visible]);

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of trains) m.set(x.type, (m.get(x.type) ?? 0) + 1);
    return sortTrainTypes(Array.from(m.keys())).map((k) => [k, m.get(k) ?? 0] as const);
  }, [trains]);

  const filtered = filters.types.length > 0 || filters.motion !== 'all' || filters.speed !== 'all';
  const toggleType = (type: string) =>
    onFilters({ ...filters, types: filters.types.includes(type) ? filters.types.filter((x) => x !== type) : [...filters.types, type] });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overscroll-contain p-3.5">
      {/* the LED board */}
      <section className="board board-glass relative px-3.5 py-3" aria-label={t('home.rightNow')}>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-medium leading-none text-white/55">{t('home.trainsRunning')}</p>
            <p className="led mt-1.5 text-[2.6rem]" aria-live="polite">
              {nf.format(rolled)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 pb-1">
            <span className="flex items-center gap-1.5 text-[0.6875rem] text-white/50">
              <span className={cn('h-1.5 w-1.5 rounded-full', stale ? 'bg-[#ff8a1f]' : 'bg-[#4ade80]')} aria-hidden />
              {clock && <span className="led text-[0.95rem] text-[#ffb43a]/85">{clock}</span>}
            </span>
            <button
              type="button"
              onClick={onRefresh}
              aria-label={t('home.refreshFeed')}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#ffb43a] transition-colors hover:bg-white/15"
            >
              <RefreshCcw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} aria-hidden />
            </button>
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-x-4 border-t border-white/10 pt-2.5">
          <LedReadout label={t('home.movingShare')} value={`${stats.movingPct}`} unit="%" tone="green" />
          <LedReadout label={t('home.avgSpeed')} value={`${stats.avg}`} unit={t('common.kmh')} />
        </div>
        {stats.fastest && (
          <button type="button" onClick={() => onOpenTrain(stats.fastest!.n)} className="mt-2.5 flex w-full items-center justify-between gap-3 border-t border-white/10 pt-2.5 text-left">
            <span className="min-w-0">
              <span className="block text-[0.6875rem] font-medium leading-none text-white/55">{t('home.fastestTrain')}</span>
              <span className="mt-1 block break-words text-caption font-semibold leading-snug text-white/85">
                {stats.fastest.n} {stats.fastest.name}
              </span>
            </span>
            <span className="led shrink-0 text-[1.4rem]">
              {stats.fastest.spd}
              <span className="ml-1 text-[0.75rem] opacity-70">{t('common.kmh')}</span>
            </span>
          </button>
        )}
      </section>

      {/* filters */}
      <section aria-label={t('home.filters')}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-body font-bold">{t('home.trainKinds')}</h2>
          {filtered ? (
            <button type="button" onClick={() => onFilters(DEFAULT_FILTERS)} className="text-caption font-semibold text-accent underline decoration-lamp decoration-2 underline-offset-4">
              {t('home.clearFilters')}
            </button>
          ) : (
            <span className="text-caption text-ink-muted">{t('home.showing', { n: nf.format(shown), total: nf.format(total) })}</span>
          )}
        </div>
        <ul className="grid grid-cols-2 gap-1.5">
          {typeCounts.map(([type, count]) => {
            const on = filters.types.includes(type);
            return (
              <li key={type}>
                <button
                  type="button"
                  onClick={() => toggleType(type)}
                  aria-pressed={on}
                  className={cn(
                    'flex min-h-9 w-full items-center gap-2 rounded-lg border px-2.5 text-left text-caption font-semibold transition-colors',
                    on ? 'border-ink bg-lamp text-[#141826]' : 'border-ink/15 bg-surface-elevated/50 hover:bg-surface-elevated',
                  )}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-surface-raised" style={{ backgroundColor: trainTypeColor(type) }} aria-hidden />
                  <span className="min-w-0 flex-1 break-words leading-tight">{trainTypeLabel(type, lang)}</span>
                  <span className="led text-[0.95rem] opacity-70">{nf.format(count)}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-3 grid grid-cols-3 gap-1.5" role="group" aria-label={t('home.motion')}>
          {(
            [
              ['all', t('home.motion.all')],
              ['GPS', t('home.motion.moving')],
              ['STATION', t('home.motion.atStn')],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={filters.motion === k}
              onClick={() => onFilters({ ...filters, motion: filters.motion === k && k !== 'all' ? 'all' : k })}
              className={cn(
                'min-h-9 rounded-md border px-2 text-caption font-bold transition-colors',
                filters.motion === k ? 'border-ink bg-ink text-surface-raised' : 'border-ink/20 text-ink-muted hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {(
            [
              ['moving', t('home.speed.fast')],
              ['stopped', t('home.speed.idle')],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={filters.speed === k}
              onClick={() => onFilters({ ...filters, speed: filters.speed === k ? 'all' : k })}
              className={cn(
                'min-h-9 rounded-md border px-2 text-caption font-bold transition-colors',
                filters.speed === k ? 'border-ink bg-ink text-surface-raised' : 'border-ink/20 text-ink-muted hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {favorites.length > 0 && (
        <section aria-label={t('common.favourites')}>
          <h2 className="mb-2 flex items-center gap-1.5 text-body font-bold">
            <Star className="h-4 w-4 fill-lamp text-ink" aria-hidden /> {t('common.favourites')}
          </h2>
          <ul className="space-y-1.5">
            {favorites.map((f) => (
              <li key={f.number}>
                <button
                  type="button"
                  onClick={() => onOpenTrain(f.number)}
                  className="flex min-h-10 w-full items-center gap-2.5 rounded-lg border border-ink/15 bg-surface-elevated/50 px-3 text-left transition-colors hover:bg-surface-elevated"
                >
                  <span className="led text-[1.1rem] text-ink-muted">{f.number}</span>
                  <span className="min-w-0 flex-1 break-words text-body font-semibold">{f.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}

export function HomePanel(props: HomePanelProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const rolled = useCountUp(props.visible.length);

  return (
    <>
      {/* desktop and tablet: a right-hand panel that slides away to the right edge */}
      <motion.div
        className="pointer-events-none absolute right-3 top-3 z-20 hidden w-[20.5rem] md:block"
        initial={false}
        animate={{ x: props.collapsed ? 'calc(100% + 0.75rem)' : 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 38 }}
      >
        <button
          type="button"
          onClick={props.onToggleCollapsed}
          aria-expanded={!props.collapsed}
          aria-label={props.collapsed ? t('home.showPanel') : t('home.hidePanel')}
          className="glass-strong panel-glass pointer-events-auto absolute -left-10 top-5 flex h-12 w-10 items-center justify-center rounded-l-xl border-r-0 text-ink transition-colors hover:bg-surface-elevated"
        >
          <ChevronRight className={cn('h-5 w-5 transition-transform duration-300', props.collapsed && 'rotate-180')} aria-hidden />
        </button>
        <aside aria-label={t('home.rightNow')} className="glass-strong panel-glass pointer-events-auto flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-2xl">
          <PanelBody {...props} />
        </aside>
      </motion.div>

      {/* mobile: one floating button opens the same panel as a sheet */}
      {!props.hideTrigger && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('home.openPanel')}
          className="board absolute bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-3 z-20 flex min-h-12 items-center gap-2 rounded-xl px-3 active:scale-[0.97] md:hidden"
        >
          <span className="led text-[1.45rem]">{nf.format(rolled)}</span>
          <SlidersHorizontal className="h-4 w-4 text-white/70" aria-hidden />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/55" onClick={() => setOpen(false)} aria-hidden />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t('home.openPanel')}
              className="glass-strong absolute inset-x-0 bottom-0 flex max-h-[82dvh] flex-col rounded-t-3xl pb-[env(safe-area-inset-bottom)]"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            >
              <div className="flex items-center justify-between px-4 pt-3">
                <span className="mx-auto h-1.5 w-10 rounded-full bg-ink/25" aria-hidden />
                <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close')} className="absolute right-3 top-2 flex h-10 w-10 items-center justify-center rounded-full text-ink-muted">
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
              <PanelBody
                {...props}
                onOpenTrain={(n) => {
                  setOpen(false);
                  props.onOpenTrain(n);
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
