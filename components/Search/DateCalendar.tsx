'use client';

import { useMemo, useRef, useState } from 'react';
import { useDialogFocus } from '@/lib/useDialogFocus';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { isoDate, isoToDate } from '@/lib/format';
import { useT } from '@/lib/i18n/useT';

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export function DateCalendar({ value, min, max, maxDays, onPick, onClose }: { value: string; min: string; max: string; maxDays: number; onPick: (iso: string) => void; onClose: () => void }) {
  const { t, lang } = useT();
  const start = isoToDate(value);
  const [ym, setYm] = useState({ y: start.getUTCFullYear(), m: start.getUTCMonth() });

  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(dialog, true, onClose);

  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { ...o, timeZone: 'UTC' });
  const monthLabel = fmt({ month: 'long', year: 'numeric' }).format(new Date(Date.UTC(ym.y, ym.m, 1)));
  // Monday-first week header
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => fmt({ weekday: 'narrow' }).format(new Date(Date.UTC(2026, 9, 5 + i)))), [lang]);

  const lead = (new Date(Date.UTC(ym.y, ym.m, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const cells: Array<number | null> = [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const today = isoDate(0);
  const tomorrow = isoDate(1);

  const minD = isoToDate(min);
  const maxD = isoToDate(max);
  const canPrev = ym.y * 12 + ym.m > minD.getUTCFullYear() * 12 + minD.getUTCMonth();
  const canNext = ym.y * 12 + ym.m < maxD.getUTCFullYear() * 12 + maxD.getUTCMonth();
  const step = (n: number) => setYm(({ y, m }) => ({ y: y + Math.floor((m + n) / 12), m: (m + n + 12) % 12 }));

  const long = fmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(isoToDate(value));

  return (
    <>
      <div className="fixed inset-0 z-[74] bg-black/45 sm:bg-transparent" onClick={onClose} aria-hidden />
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={t('cal.title')}
        className="fixed inset-x-0 bottom-0 z-[75] overflow-hidden rounded-t-3xl border border-ink/25 bg-surface-elevated pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_24px_60px_-12px_rgb(40_30_10/0.55)] sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-2 sm:w-[21.5rem] sm:rounded-2xl sm:pb-0"
      >
        {/* ticket-stub header: the chosen day in LED digits */}
        <div className="flex items-center justify-between gap-3 bg-[#10131c] px-4 py-3 text-white">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-semibold text-white/55">{t('cal.title')}</p>
            <p className="led text-[1.5rem] text-[#ffb43a]" style={{ textShadow: '0 0 8px rgb(255 160 40 / .45)' }}>{long}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/15">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="p-3">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => step(-1)} disabled={!canPrev} aria-label={t('cal.prev')} className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/25 disabled:opacity-25 active:scale-95">
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <h2 className="text-body font-bold capitalize" aria-live="polite">{monthLabel}</h2>
            <button type="button" onClick={() => step(1)} disabled={!canNext} aria-label={t('cal.next')} className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/25 disabled:opacity-25 active:scale-95">
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-y-1 text-center" role="grid">
            {weekdays.map((w, i) => (
              <span key={i} className={cn('py-1 text-caption font-bold', i >= 5 ? 'text-stamp' : 'text-ink-muted')} role="columnheader">{w}</span>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <span key={`b${i}`} />;
              const iso = toIso(ym.y, ym.m, d);
              const off = iso < min || iso > max;
              const on = iso === value;
              const weekend = (i % 7) >= 5;
              return (
                <button
                  key={iso}
                  type="button"
                  role="gridcell"
                  disabled={off}
                  aria-selected={on}
                  data-autofocus={on || undefined}
                  aria-label={fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(isoToDate(iso))}
                  onClick={() => onPick(iso)}
                  className={cn(
                    'mx-auto flex h-10 w-10 items-center justify-center rounded-full text-body font-semibold transition-transform active:scale-90',
                    on ? 'pill-on' : off ? 'text-ink-muted/30 line-through decoration-1' : 'hover:bg-ink/[0.07]',
                    !on && !off && weekend && 'text-stamp',
                    !on && iso === today && 'ring-2 ring-ink/70',
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center gap-2 border-t border-dashed border-ink/20 pt-3">
            <button type="button" onClick={() => onPick(today)} className="min-h-10 rounded-lg border border-ink/30 px-3 text-caption font-bold hover:bg-ink/[0.05]">{t('cal.today')}</button>
            <button type="button" onClick={() => onPick(tomorrow)} className="min-h-10 rounded-lg border border-ink/30 px-3 text-caption font-bold hover:bg-ink/[0.05]">{t('cal.tomorrow')}</button>
            <span className="ml-auto text-right text-[0.6875rem] leading-tight text-ink-muted">{t('cal.limit', { n: maxDays })}</span>
          </div>
        </div>
      </div>
    </>
  );
}
