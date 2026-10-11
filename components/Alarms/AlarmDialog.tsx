'use client';

import { useEffect, useRef, useState } from 'react';
import { useDialogFocus } from '@/lib/useDialogFocus';
import { Bell, BellOff, X } from 'lucide-react';
import type { LiveJourney } from '@/types/train';
import { cn } from '@/lib/cn';
import { alarmId, useAlarmStore, useAlarmUiStore } from '@/store/useAlarmStore';
import { useT } from '@/lib/i18n/useT';

const LEADS = [5, 10, 15, 30];

export function AlarmDialog({ journey }: { journey: LiveJourney }) {
  const { t } = useT();
  const { open, setOpen } = useAlarmUiStore();
  const { alarms, add, remove } = useAlarmStore();
  const upcoming = journey.stations.filter((s) => s.status !== 'passed');
  const [station, setStation] = useState(journey.destination.code);
  const [lead, setLead] = useState(15);
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    setPerm('Notification' in window ? Notification.permission : 'unsupported');
  }, [open]);
  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(dialog, open, () => setOpen(false));

  if (!open) return null;
  const existing = alarms.find((a) => a.id === alarmId(journey.number, station));
  const mine = alarms.filter((a) => a.trainNumber === journey.number);

  const save = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      setPerm(await Notification.requestPermission());
    }
    const st = journey.stations.find((s) => s.code === station);
    add({ trainNumber: journey.number, trainName: journey.name, stationCode: station, stationName: st?.name ?? station, leadMin: lead });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
      <div ref={dialog} role="dialog" aria-modal="true" aria-label={t('alarm.title')} className="glass-strong relative w-full max-w-md rounded-t-sheet p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-sheet">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-subhead">{t('alarm.title')}</h2>
            <p className="text-caption text-ink-muted">{t('alarm.sub', { train: journey.name })}</p>
          </div>
          <button onClick={() => setOpen(false)} aria-label={t('common.close')} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-ink/[0.06]">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <label htmlFor="alarm-station" className="mt-4 block text-caption font-semibold text-ink-muted">
          {t('alarm.at')}
        </label>
        <select
          id="alarm-station"
          value={station}
          onChange={(e) => setStation(e.target.value)}
          className="mt-1 h-12 w-full rounded-2xl border border-ink/[0.08] bg-surface-raised px-3 text-body font-medium outline-none focus:border-accent/50"
        >
          {upcoming.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name} ({s.code}) · {s.actualArrival ?? s.scheduledArrival}
            </option>
          ))}
        </select>

        <p className="mt-4 text-caption font-semibold text-ink-muted">{t('alarm.lead')}</p>
        <div className="mt-1 grid grid-cols-4 gap-2" role="radiogroup" aria-label={t('alarm.lead')}>
          {LEADS.map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={lead === m}
              onClick={() => setLead(m)}
              className={cn('h-11 rounded-2xl border text-body font-semibold transition-all active:scale-95', lead === m ? 'border-accent/50 cta-lamp' : 'border-ink/[0.08] bg-surface-raised/70')}
            >
              {m}
            </button>
          ))}
        </div>

        <button onClick={save} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl  text-body font-semibold   transition-transform active:scale-[0.98] cta-lamp">
          <Bell className="h-4 w-4" aria-hidden /> {existing && !existing.firedAt ? t('alarm.update') : t('alarm.set')}
        </button>
        <p className="mt-2 text-caption text-ink-muted">
          {perm === 'granted'
            ? t('alarm.permGranted')
            : perm === 'denied'
              ? t('alarm.permDenied')
              : t('alarm.permDefault')}
        </p>

        {mine.length > 0 && (
          <ul className="mt-4 space-y-1.5 border-t border-ink/[0.06] pt-3" aria-label={t('alarm.yours')}>
            {mine.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 rounded-xl bg-ink/[0.04] px-3 py-2 text-caption">
                <span className="min-w-0 break-words">
                  {a.stationName} · {a.leadMin} min before {a.firedAt && <b className="text-status-onTime">· done</b>}
                </span>
                <button onClick={() => remove(a.id)} aria-label={`${t('common.remove')} ${a.stationName}`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-ink">
                  <BellOff className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
