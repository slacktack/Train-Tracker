'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Radio, X } from 'lucide-react';
import type { AvailabilityTrain, ClassAvailability } from '@/lib/sources/confirmtkt';
import { cn } from '@/lib/cn';
import { formatDay, formatInr } from '@/lib/format';
import { useT } from '@/lib/i18n/useT';
import { useStationName } from '@/lib/i18n/stationNames';
import { humanMinutes } from '@/lib/where-now';
import { TrendsPanel } from './TrendsPanel';

export interface SplitPanel {
  train: AvailabilityTrain;
  depIso: string;
  depTime: string;
  arrIso: string;
  arrTime: string;
}

export interface SplitConnection {
  hub: { code: string; name: string };
  layoverMin: number;
  risk: 'tight' | 'ok' | 'long';
}

const TONE = {
  confirm: { bar: 'bg-status-onTime', text: 'text-status-onTime' },
  probable: { bar: 'bg-status-minorDelay', text: 'text-status-minorDelay' },
  'no-chance': { bar: 'bg-status-heavyDelay', text: 'text-status-heavyDelay' },
  closed: { bar: 'bg-ink-muted/50', text: 'text-ink-muted' },
  unknown: { bar: 'bg-ink-muted/40', text: 'text-ink' },
} as const;
const RISK = { tight: 'border-stamp text-stamp', ok: 'border-status-onTime text-status-onTime', long: 'border-ink/30 text-ink-muted' } as const;

const dmy = (iso: string) => iso.split('-').reverse().join('-');

function Column({ panel, quota, chosen, onChoose }: { panel: SplitPanel; quota: string; chosen: string | null; onChoose: (cls: string | null) => void }) {
  const { t, lang } = useT();
  const local = useStationName();
  const tr = panel.train;
  const sel = tr.classes.find((c) => c.cls === chosen) ?? null;
  const confirmTkt = `https://www.confirmtkt.com/rbooking/trains/from/${tr.from.code}/to/${tr.to.code}/${dmy(panel.depIso)}`;

  return (
    <section className="flex min-w-0 flex-1 flex-col rounded-xl border border-ink/20 bg-surface-raised/90" aria-label={`${tr.number} ${tr.name}`}>
      <header className="flex items-start gap-3 rounded-t-xl bg-[#10131c] p-3 text-white">
        <span className="led text-[1.5rem] text-[#ffb43a]">{tr.number}</span>
        <div className="min-w-0">
          <h3 className="break-words text-body font-bold leading-snug">{tr.name}</h3>
          <p className="text-caption text-white/60">{tr.runsOn.join(' ')}</p>
        </div>
      </header>

      <div className="flex items-center gap-2 border-b border-dashed border-ink/20 p-3">
        <div className="min-w-0">
          <p className="led text-[1.4rem]">{panel.depTime}</p>
          <p className="break-words text-caption font-medium text-ink-muted">{local(tr.from.code, tr.from.name)}</p>
          <p className="text-caption text-ink-muted">{formatDay(panel.depIso, lang)}</p>
        </div>
        <span className="relative mx-1 h-[2px] min-w-[1rem] flex-1 bg-ink/25" aria-hidden>
          <span className="absolute -top-[3px] left-0 h-2 w-2 rounded-full border-2 border-ink bg-surface-raised" />
          <span className="absolute -top-[3px] right-0 h-2 w-2 rounded-full bg-ink" />
        </span>
        <div className="min-w-0 text-right">
          <p className="led text-[1.4rem]">{panel.arrTime}</p>
          <p className="break-words text-caption font-medium text-ink-muted">{local(tr.to.code, tr.to.name)}</p>
          <p className="text-caption text-ink-muted">{formatDay(panel.arrIso, lang)}</p>
        </div>
      </div>

      <div className="p-3">
        <p className="mb-2 text-caption font-semibold text-ink-muted">{t('split.pick')}</p>
        <div className="grid grid-cols-2 gap-2">
          {tr.classes.map((c: ClassAvailability) => {
            const tone = TONE[c.verdict];
            const on = c.cls === chosen;
            return (
              <button
                key={c.cls}
                type="button"
                onClick={() => onChoose(on ? null : c.cls)}
                aria-pressed={on}
                className={cn('relative overflow-hidden rounded-lg border bg-surface-elevated/70 py-2 pl-3.5 pr-2.5 text-left transition-transform active:scale-[0.97]', on ? 'border-ink shadow-glow' : 'border-ink/15')}
              >
                <span className={cn('absolute inset-y-0 left-0 w-1.5', tone.bar)} aria-hidden />
                <span className="flex items-baseline justify-between gap-1">
                  <span className="text-subhead font-bold leading-none">{c.cls}</span>
                  {c.fare && <span className="text-caption text-ink-muted">{formatInr(c.fare)}</span>}
                </span>
                <span className={cn('mt-1 block text-body font-bold leading-tight', tone.text)}>{c.status}</span>
                {c.prediction && <span className="block text-caption leading-tight text-ink-muted">{c.prediction}</span>}
              </button>
            );
          })}
        </div>

        {sel && <div className="mt-2 rounded-lg border border-ink/10 bg-surface/60 px-3 pb-3"><TrendsPanel train={tr.number} cls={sel.cls} quota={quota} date={panel.depIso} /></div>}

        {tr.alternates && tr.alternates.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {tr.alternates.slice(0, 2).map((a) => (
              <li key={`${a.cls}-${a.kind}`} className="rounded-lg border border-dashed border-ink/35 px-2.5 py-2 text-caption">
                <b>{a.kind === 'split' ? t('trains.splitTicket') : t('trains.nearbySeat')}</b> · {a.cls}
                {a.totalFare ? ` · ${formatInr(a.totalFare)}` : ''}
                <span className="block font-semibold">{a.segments.map((g) => `${g.from}→${g.to} ${g.status}`).join('  +  ')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 border-t border-dashed border-ink/20 p-3">
        <Link href={`/track/${tr.number}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-ink/30 px-3 text-caption font-bold hover:bg-ink/[0.05]">
          <Radio className="h-4 w-4" aria-hidden /> {t('trains.liveStatus')}
        </Link>
        <a href={confirmTkt} target="_blank" rel="noopener noreferrer" className="cta-lamp inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-caption font-bold">
          {t('split.book')} <ArrowUpRight className="h-4 w-4" aria-hidden />
        </a>
        <a href="https://www.irctc.co.in/nget/train-search" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-ink/30 px-3 text-caption font-semibold text-ink-muted hover:text-ink">
          {t('split.irctc')} <ArrowUpRight className="h-4 w-4" aria-hidden />
        </a>
      </div>
    </section>
  );
}

export function SplitView({ panels, quota, connections, arrival, onClose }: { panels: SplitPanel[]; quota: string; connections?: SplitConnection[]; arrival?: { iso: string; time: string }; onClose: () => void }) {
  const { t, lang } = useT();
  const local = useStationName();
  const [chosen, setChosen] = useState<Array<string | null>>(() => panels.map(() => null));
  const [tab, setTab] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const fares = useMemo(() => panels.map((p, i) => p.train.classes.find((c) => c.cls === chosen[i])?.fare ?? null), [panels, chosen]);
  const total = fares.every((f) => f) ? fares.reduce<number>((a, b) => a + (b ?? 0), 0) : null;
  const choose = (i: number) => (cls: string | null) => setChosen((cur) => cur.map((c, k) => (k === i ? cls : c)));

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('split.title')}
        onClick={(e) => e.stopPropagation()}
        className={cn('glass-strong flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl sm:max-h-[92dvh] sm:rounded-2xl', panels.length > 2 ? 'max-w-7xl' : 'max-w-5xl')}
      >
        <div className="flex items-center justify-between gap-3 border-b border-ink/15 px-4 py-3">
          <h2 className="text-subhead font-bold">{t('split.title')}</h2>
          <button onClick={onClose} aria-label={t('common.close')} className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted hover:bg-ink/[0.07]">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {connections && connections.length > 0 && (
          <ul className="border-b border-dashed border-ink/20 bg-lamp/25 px-4 py-2.5">
            {connections.map((c) => (
              <li key={c.hub.code} className="flex flex-wrap items-center gap-2">
                <span className="text-caption font-bold">{t('split.connection')}</span>
                <span className="text-body font-bold">{t('trains.changeAt', { station: local(c.hub.code, c.hub.name) })}</span>
                <span className="text-caption font-semibold text-ink-muted">{t('trains.wait', { x: humanMinutes(c.layoverMin, lang) })}</span>
                <span className={cn('rounded-md border px-1.5 py-0.5 text-caption font-bold', RISK[c.risk])}>{t(`trains.risk.${c.risk}` as 'trains.risk.ok')}</span>
              </li>
            ))}
          </ul>
        )}

        {/* phones: one train at a time; wide screens: all at once */}
        <div className="flex gap-1.5 overflow-x-auto p-3 sm:hidden no-scrollbar" role="tablist" aria-label={t('split.title')}>
          {panels.map((p, i) => (
            <button
              key={`${p.train.number}-${i}`}
              role="tab"
              aria-selected={tab === i}
              onClick={() => setTab(i)}
              className={cn('min-h-11 shrink-0 flex-1 rounded-lg border px-2 text-caption font-bold', tab === i ? 'pill-on border-ink' : 'border-ink/25 text-ink-muted')}
            >
              {t('trains.legTrain', { n: i + 1 })} · {p.train.number}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
          <div className="flex gap-3">
            {panels.map((p, i) => (
              <div key={`${p.train.number}-${i}`} className={cn('min-w-0 flex-1', tab !== i && 'hidden sm:block')}>
                <Column panel={p} quota={quota} chosen={chosen[i]} onChoose={choose(i)} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/15 bg-surface-elevated/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <p className="text-body font-bold">
            {total ? `${t('split.fareTotal')}: ${formatInr(total)}` : <span className="text-caption font-semibold text-ink-muted">{t('split.noClass')}</span>}
          </p>
          {arrival && <p className="text-caption font-semibold text-ink-muted">{t('split.arrival', { date: formatDay(arrival.iso, lang), time: arrival.time })}</p>}
        </div>
      </div>
    </div>
  );
}
