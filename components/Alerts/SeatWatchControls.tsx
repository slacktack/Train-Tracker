'use client';

import { Bell, BellRing, Timer } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n/useT';
import { isBookable, seatWatchId, tatkalOpensAt, tatkalWatchId } from '@/lib/watch';
import { useWatchStore } from '@/store/useWatchStore';

interface Props {
  train: { number: string; name: string; from: string; to: string };
  date: string;
  cls: string;
  quota: string;
  status: string;
}

const IST_MS = 5.5 * 3600_000;

export function SeatWatchControls({ train, date, cls, quota, status }: Props) {
  const { t } = useT();
  const { watches, toggle } = useWatchStore();
  const base = { train: train.number, trainName: train.name, from: train.from, to: train.to, date, cls };
  const seatId = seatWatchId({ ...base, quota });
  const tatId = tatkalWatchId(base);
  const seatOn = watches.some((w) => w.id === seatId);
  const tatOn = watches.some((w) => w.id === tatId);
  const opens = tatkalOpensAt(date, cls);
  const showTatkal = quota !== 'TQ' && Date.now() < opens;
  const opensLabel = new Date(opens + IST_MS).toISOString().slice(11, 16);
  const bookable = isBookable(status);

  const btn = (on: boolean) =>
    cn('inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-caption font-bold transition-colors', on ? 'pill-on border-ink' : 'border-ink/25 hover:bg-ink/[0.05]');

  return (
    <div className="flex flex-wrap gap-2 pt-3">
      {!bookable && (
        <button type="button" aria-pressed={seatOn} onClick={() => toggle({ ...base, kind: 'seat', id: seatId, quota, lastStatus: status })} className={btn(seatOn)}>
          {seatOn ? <BellRing className="h-4 w-4" aria-hidden /> : <Bell className="h-4 w-4" aria-hidden />}
          {seatOn ? t('watch.seatOn', { cls }) : t('watch.seat', { cls })}
        </button>
      )}
      {showTatkal && (
        <button type="button" aria-pressed={tatOn} onClick={() => toggle({ ...base, kind: 'tatkal', id: tatId, leadMin: 10 })} className={btn(tatOn)}>
          <Timer className="h-4 w-4" aria-hidden />
          {tatOn ? t('watch.tatkalOn', { time: opensLabel }) : t('watch.tatkal', { time: opensLabel })}
        </button>
      )}
      {(seatOn || tatOn) && <p className="w-full text-caption text-ink-muted">{t('watch.noGuarantee')}</p>}
    </div>
  );
}
