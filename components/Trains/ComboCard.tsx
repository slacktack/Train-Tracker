'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Columns2, Radio } from 'lucide-react';
import { SplitView } from './SplitView';
import type { Combo, ComboLeg } from '@/lib/combos-types';
import { bestClassOf } from '@/lib/best-class';
import { cn } from '@/lib/cn';
import { formatDay, formatInr } from '@/lib/format';
import { useT } from '@/lib/i18n/useT';
import { useStationName } from '@/lib/i18n/stationNames';
import { humanMinutes } from '@/lib/where-now';

const RISK = {
  tight: 'border-stamp text-stamp',
  ok: 'border-status-onTime text-status-onTime',
  long: 'border-ink/30 text-ink-muted',
} as const;

function dayGap(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

function Leg({ leg, n, hubCode }: { leg: ComboLeg; n: 1 | 2; hubCode: string }) {
  const { t, lang } = useT();
  const local = useStationName();
  const best = bestClassOf(leg.train);
  const t1 = leg.train;
  return (
    <div className="flex gap-3">
      <div className="flex w-16 shrink-0 flex-col items-center gap-1 rounded-lg bg-[#10131c] px-1 py-2 text-center">
        <span className="text-[0.625rem] font-semibold text-white/55">{t('trains.legTrain', { n })}</span>
        <span className="led text-[1.15rem] text-[#ffb43a]">{t1.number}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="break-words text-body font-bold leading-snug">{t1.name}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="min-w-0">
            <p className="led text-[1.35rem]">{leg.depTime}</p>
            <p className="break-words text-caption font-medium text-ink-muted">{local(t1.from.code, t1.from.name)}</p>
          </div>
          <div className="flex min-w-[3.5rem] flex-1 flex-col items-center">
            <span className="text-caption font-bold text-ink">{humanMinutes(leg.durationMin, lang)}</span>
            <span className="relative my-1 h-[2px] w-full bg-ink/25" aria-hidden>
              <span className="absolute -top-[3px] left-0 h-2 w-2 rounded-full border-2 border-ink bg-surface-raised" />
              <span className="absolute -top-[3px] right-0 h-2 w-2 rounded-full bg-ink" />
            </span>
          </div>
          <div className="min-w-0 text-right">
            <p className="led text-[1.35rem]">
              {leg.arrTime}
              {leg.arrIso !== leg.depIso && <sup className="ml-0.5 text-caption font-bold text-ink-muted">+{dayGap(leg.depIso, leg.arrIso)}</sup>}
            </p>
            <p className="break-words text-caption font-medium text-ink-muted">{local(t1.to.code, t1.to.name)}</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-caption">
          <span className="text-ink-muted">{formatDay(leg.depIso, lang)}</span>
          {best && (
            <span
              className={cn(
                'rounded-md px-1.5 py-0.5 font-bold',
                best.verdict === 'confirm' ? 'bg-status-onTime/15 text-status-onTime' : best.verdict === 'probable' ? 'bg-status-minorDelay/20 text-ink' : 'bg-status-heavyDelay/15 text-status-heavyDelay',
              )}
            >
              {best.cls} {best.status}
              {best.fare ? ` · ${formatInr(best.fare)}` : ''}
            </span>
          )}
          <Link href={`/track/${t1.number}`} className="ml-auto inline-flex min-h-8 items-center gap-1 font-semibold text-ink-muted hover:text-ink">
            <Radio className="h-3.5 w-3.5" aria-hidden /> {t('trains.liveStatus')}
          </Link>
        </div>
        <span className="sr-only">{hubCode}</span>
      </div>
    </div>
  );
}

export function ComboCard({ combo, quota, fare: fareProp }: { combo: Combo; quota: string; fare?: number | null }) {
  const [open, setOpen] = useState(false);
  const { t, lang } = useT();
  const local = useStationName();
  const sum = combo.legs.map((l) => bestClassOf(l.train)?.fare ?? 0);
  const fare = fareProp ?? (sum.every(Boolean) ? sum.reduce((x, y) => x + y, 0) : null);

  return (
    <article className="rounded-xl border border-ink/20 bg-surface-raised/90 p-3.5 shadow-glow" aria-label={combo.legs.map((l) => l.train.number).join(' + ')}>
      <div className="flex flex-wrap items-center gap-1.5">
        {combo.tags?.map((tag) => (
          <span key={tag} className="rounded-md border border-ink bg-lamp px-2 py-0.5 text-caption font-bold text-[#141826]">
            {t(`trains.tag.${tag}` as 'trains.tag.fastest')}
          </span>
        ))}
        <span className="ml-auto text-right text-caption font-semibold text-ink-muted">
          {t('trains.total', { x: humanMinutes(combo.totalMin, lang) })} · {t('trains.arrives', { time: combo.arrTime })}
        </span>
      </div>

      <div className="mt-3">
        {combo.legs.map((l, i) => {
          const stop = combo.stops[i];
          return (
            <div key={`${l.train.number}-${l.depIso}-${i}`}>
              <Leg leg={l} n={(i + 1) as 1 | 2} hubCode="" />
              {stop && (
                <div className="my-2.5 ml-[4.75rem] flex flex-wrap items-center gap-2 border-l-[3px] border-dashed border-ink/25 py-1 pl-3">
                  {stop.sameTrain ? (
                    <>
                      <span className="text-body font-bold">{t('trains.sameTrain')}</span>
                      <span className="text-caption font-semibold text-ink-muted">{local(stop.hub.code, stop.hub.name)} · {t('trains.sameTrainHint')}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-body font-bold">{t('trains.changeAt', { station: local(stop.hub.code, stop.hub.name) })}</span>
                      <span className="text-caption font-semibold text-ink-muted">{t('trains.wait', { x: humanMinutes(stop.layoverMin, lang) })}</span>
                      <span className={cn('rounded-md border px-1.5 py-0.5 text-caption font-bold', RISK[stop.risk])}>{t(`trains.risk.${stop.risk}` as 'trains.risk.ok')}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 border-t border-dashed border-ink/20 pt-2.5 text-caption text-ink-muted">
        {fare ? `${t('trains.fareSum', { fare: formatInr(fare) })} · ` : ''}
        {t('trains.bookBoth')}
      </p>
      <button type="button" onClick={() => setOpen(true)} className="cta-lamp mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-3 text-body font-bold">
        <Columns2 className="h-4 w-4" aria-hidden /> {t('split.open')}
      </button>
      {open && (
        <SplitView
          quota={quota}
          onClose={() => setOpen(false)}
          connections={combo.stops.map((x) => ({ hub: x.hub, layoverMin: x.layoverMin, risk: x.risk }))}
          arrival={{ iso: combo.arrIso, time: combo.arrTime }}
          panels={combo.legs.map((l) => ({ train: l.train, depIso: l.depIso, depTime: l.depTime, arrIso: l.arrIso, arrTime: l.arrTime }))}
        />
      )}
    </article>
  );
}
