'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Radio, Search, X } from 'lucide-react';
import type { LiveTrain } from '@/types/train';
import { useT } from '@/lib/i18n/useT';
import { useDialogFocus } from '@/lib/useDialogFocus';
import { trainTypeColor } from '@/lib/train-type';

const LIMIT = 150;

// Every train on the map, reachable without map gestures.
export function TrainListDialog({ trains, onPick, onClose }: { trains: LiveTrain[]; onPick: (t: LiveTrain) => void; onClose: () => void }) {
  const { t } = useT();
  const [q, setQ] = useState('');
  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(dialog, true, onClose);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? trains.filter((x) => x.n.includes(needle) || (x.name ?? '').toLowerCase().includes(needle) || (x.stn ?? '').toLowerCase().includes(needle) || (x.stc ?? '').toLowerCase() === needle)
      : trains;
    return [...list].sort((a, b) => a.n.localeCompare(b.n));
  }, [trains, q]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={t('list.title')}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-ink/15 px-4 py-3">
          <h2 className="text-subhead font-bold">{t('list.title')}</h2>
          <button onClick={onClose} aria-label={t('common.close')} className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted hover:bg-ink/[0.07]">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="px-4 pt-3">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-ink/20 bg-surface-raised px-3 focus-within:border-ink/60">
            <Search className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
            <span className="sr-only">{t('list.search')}</span>
            <input
              data-autofocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('list.search')}
              className="min-w-0 flex-1 bg-transparent text-body outline-none"
            />
          </label>
          <p className="mt-2 text-caption text-ink-muted" role="status" aria-live="polite">
            {matches.length > LIMIT ? t('list.countMore', { n: LIMIT, total: matches.length }) : t('list.count', { n: matches.length })}
          </p>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1">
          {matches.slice(0, LIMIT).map((x) => (
            <li key={`${x.n}-${x.st}`} className="flex items-center gap-1">
              <button type="button" onClick={() => onPick(x)} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 text-left hover:bg-ink/[0.05]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: trainTypeColor(x.type) }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-body font-semibold">
                    <span className="font-mono">{x.n}</span> {x.name ?? ''}
                  </span>
                  <span className="block text-caption text-ink-muted">
                    {x.src === 'STATION' ? t('list.at', { station: x.stn ?? x.stc ?? '' }) : x.stn ? t('list.near', { station: x.stn }) : t('list.running')}
                    {x.spd ? ` · ${x.spd} ${t('common.kmh')}` : ''}
                  </span>
                </span>
              </button>
              <Link href={`/track/${x.n}`} aria-label={`${t('trip.track')} ${x.n}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-ink/[0.05] hover:text-ink">
                <Radio className="h-4 w-4" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
