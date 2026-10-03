'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { DateCalendar } from './DateCalendar';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n/useT';
import { daysFromToday, formatChip, isoDate } from '@/lib/format';

const CHIP_COUNT = 6;
const MAX_AHEAD_DAYS = 120;

export function DateStrip({ value, onChange, label }: { value: string; onChange: (iso: string) => void; label?: string }) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const offsets = Array.from({ length: CHIP_COUNT }, (_, i) => i);
  const inStrip = offsets.some((o) => isoDate(o) === value);
  return (
    <div className="relative min-w-0">
      <p className="mb-1 text-caption font-semibold text-ink-muted">{label ?? t('common.date')}</p>
      <div className="flex items-stretch gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {offsets.map((o) => {
          const iso = isoDate(o);
          const { top, bottom } = formatChip(iso, o, lang);
          const active = iso === value;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onChange(iso)}
              aria-pressed={active}
              className={cn(
                'flex min-w-[3.6rem] shrink-0 flex-col items-center rounded-2xl border px-2.5 py-1.5 transition-all active:scale-95',
                active ? 'pill-on' : 'border-ink/[0.08] bg-surface-raised/70 text-ink hover:border-accent/40',
              )}
            >
              <span className={cn('text-label', active ? 'text-[#141826]/75' : 'text-ink-muted')}>{top}</span>
              <span className="text-body font-semibold leading-tight">{bottom}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label={t('trains.pickDate')}
          className={cn(
            'flex min-w-[3.6rem] shrink-0 flex-col items-center justify-center rounded-2xl border px-2.5 py-1.5 transition-all active:scale-95',
            !inStrip ? 'pill-on border-ink/80' : 'border-ink/[0.08] bg-surface-raised/70 text-ink-muted hover:border-accent/40',
          )}
        >
          <CalendarDays className="h-4 w-4" aria-hidden />
          <span className="text-label">{inStrip ? t('common.more') : formatChip(value, daysFromToday(value), lang).bottom}</span>
        </button>
      </div>
      {open && (
        <DateCalendar
          value={value}
          min={isoDate(0)}
          max={isoDate(MAX_AHEAD_DAYS)}
          maxDays={MAX_AHEAD_DAYS}
          onPick={(iso) => {
            onChange(iso);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
