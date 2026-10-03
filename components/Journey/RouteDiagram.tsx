'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, TrainFront } from 'lucide-react';
import type { LiveJourney, Station } from '@/types/train';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n/useT';
import { useStationName } from '@/lib/i18n/stationNames';
import { formatDelayMin } from '@/lib/format';

type Row =
  | { type: 'stop'; station: Station; role: 'origin' | 'destination' | 'passed' | 'next' | 'upcoming' | 'here' }
  | { type: 'train'; between: [Station | undefined, Station | undefined] }
  | { type: 'fold'; side: 'passed' | 'upcoming'; stations: Station[] };

export function buildRows(j: LiveJourney, openPassed: boolean, openUpcoming: boolean): Row[] {
  const st = j.stations;
  if (st.length === 0) return [];
  const rows: Row[] = [];
  const hereIdx = st.findIndex((s) => s.status === 'current');
  const nextIdx = st.findIndex((s) => s.status === 'upcoming');
  const lastPassedIdx = st.reduce((acc, s, i) => (s.status === 'passed' ? i : acc), -1);
  const focusStart = hereIdx >= 0 ? hereIdx : lastPassedIdx >= 0 ? lastPassedIdx : 0;
  const focusEnd = nextIdx >= 0 ? nextIdx : st.length - 1;
  const lastIdx = st.length - 1;

  const push = (i: number, role: 'origin' | 'destination' | 'passed' | 'next' | 'upcoming' | 'here') => rows.push({ type: 'stop', station: st[i], role });

  // origin
  push(0, hereIdx === 0 ? 'here' : 'origin');
  // passed stops between origin and focus
  const passedMid = st.slice(1, focusStart);
  if (passedMid.length > 0) {
    if (openPassed) passedMid.forEach((s) => rows.push({ type: 'stop', station: s, role: 'passed' }));
    else rows.push({ type: 'fold', side: 'passed', stations: passedMid });
  }
  // the train's own position
  if (focusStart > 0) push(focusStart, hereIdx === focusStart ? 'here' : 'passed');
  if (hereIdx < 0 && lastPassedIdx >= 0 && j.status !== 'completed' && j.status !== 'not_started') {
    rows.push({ type: 'train', between: [st[lastPassedIdx], st[focusEnd]] });
  }
  // next stop
  if (focusEnd > focusStart && focusEnd !== lastIdx) push(focusEnd, 'next');
  // upcoming stops after the next stop, before destination
  const afterStart = Math.max(focusEnd + 1, focusStart + 1);
  const upcomingMid = st.slice(afterStart, lastIdx);
  if (upcomingMid.length > 0) {
    if (openUpcoming) upcomingMid.forEach((s) => rows.push({ type: 'stop', station: s, role: 'upcoming' }));
    else rows.push({ type: 'fold', side: 'upcoming', stations: upcomingMid });
  }
  // destination, always shown
  if (lastIdx > 0) push(lastIdx, focusEnd === lastIdx && hereIdx !== lastIdx ? 'next' : hereIdx === lastIdx ? 'here' : 'destination');
  return rows;
}

const ROLE_KEY = { origin: 'route.origin', destination: 'route.destination', next: 'route.next', here: 'route.nowHere', passed: 'route.departed', upcoming: 'route.expected' } as const;

type Tone = 'done' | 'now' | 'todo';

function toneOf(row: Row): Tone {
  if (row.type === 'train') return 'now';
  if (row.type === 'fold') return row.side === 'passed' ? 'done' : 'todo';
  return row.role === 'origin' || row.role === 'passed' ? 'done' : row.role === 'here' ? 'now' : 'todo';
}

export function RouteDiagram({ journey, className }: { journey: LiveJourney; className?: string }) {
  const { t, lang } = useT();
  const local = useStationName();
  const [openPassed, setOpenPassed] = useState(false);
  const [openUpcoming, setOpenUpcoming] = useState(false);
  const rows = useMemo(() => buildRows(journey, openPassed, openUpcoming), [journey, openPassed, openUpcoming]);

  // One fixed rail: every node sits on the same centre line, and a segment is solid only where the train has travelled.
  return (
    <ol className={cn('relative', className)} aria-label={t('card.stops')}>
      {rows.map((row, i) => {
        const tone = toneOf(row);
        const next = rows[i + 1] ? toneOf(rows[i + 1]) : null;
        const topSolid = tone !== 'todo';
        const bottomSolid = tone === 'done' && next !== null && next !== 'todo';
        const first = i === 0;
        const last = i === rows.length - 1;
        const key = row.type === 'stop' ? `s-${row.station.code}` : row.type === 'fold' ? `f-${row.side}` : 't';

        const rail = (
          <div className="relative w-8 shrink-0" aria-hidden>
            {!first && <span className={cn('absolute left-1/2 top-0 h-[1.15rem] w-[3px] -translate-x-1/2', topSolid ? 'bg-ink' : 'bg-ink/25')} />}
            {!last && <span className={cn('absolute bottom-0 left-1/2 top-[1.15rem] w-[3px] -translate-x-1/2', bottomSolid ? 'bg-ink' : 'bg-ink/25')} />}
            {row.type === 'stop' && (
              <span
                className={cn(
                  'absolute left-1/2 top-[0.35rem] flex h-[1.6rem] w-[1.6rem] -translate-x-1/2 items-center justify-center rounded-full border-[3px] border-ink',
                  tone === 'now' ? 'bg-lamp' : tone === 'done' ? 'bg-ink' : 'bg-surface-elevated',
                  row.role === 'upcoming' && 'h-[1.2rem] w-[1.2rem] top-[0.55rem] border-ink/45',
                )}
              >
                {tone === 'now' && <span className="h-2 w-2 rounded-full bg-[#141826]" />}
              </span>
            )}
            {row.type === 'train' && (
              <span className="absolute left-1/2 top-[0.35rem] flex h-[1.6rem] w-[1.6rem] -translate-x-1/2 items-center justify-center rounded-full border-[3px] border-ink bg-lamp">
                <TrainFront className="h-3.5 w-3.5 text-[#141826]" aria-hidden />
              </span>
            )}
          </div>
        );

        if (row.type === 'fold') {
          return (
            <li key={key} className="flex gap-3">
              {rail}
              <button
                type="button"
                onClick={() => (row.side === 'passed' ? setOpenPassed((v) => !v) : setOpenUpcoming((v) => !v))}
                className="my-1.5 flex min-h-10 items-center gap-1.5 self-start rounded-md border border-dashed border-ink/30 px-2.5 text-caption font-semibold text-ink-muted hover:text-ink"
              >
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                {row.side === 'passed' ? t('route.passed', { n: row.stations.length }) : t('route.more', { n: row.stations.length })}
              </button>
            </li>
          );
        }

        if (row.type === 'train') {
          return (
            <li key={key} className="flex gap-3">
              {rail}
              <span className="my-1.5 inline-flex min-h-8 items-center self-start rounded-md bg-lamp px-2.5 text-caption font-bold text-[#141826]">{t('route.nowHere')}</span>
            </li>
          );
        }

        const s = row.station;
        const here = row.role === 'here';
        const time = (s.actualArrival ?? s.scheduledArrival) !== '--:--' ? (s.actualArrival ?? s.scheduledArrival) : s.scheduledDeparture;
        const late = s.delayMinutes;
        return (
          <li key={key} className="flex gap-3">
            {rail}
            <div className={cn('flex min-h-[3.4rem] min-w-0 flex-1 items-start justify-between gap-3 py-2', here && '-mr-1 rounded-lg bg-lamp/30 px-2.5')}>
              <div className="min-w-0">
                <p className={cn('text-caption font-bold leading-tight', here ? 'text-ink' : 'text-ink-muted')}>{t(ROLE_KEY[row.role])}</p>
                <p className={cn('break-words text-body leading-snug', row.role === 'upcoming' || row.role === 'passed' ? 'font-semibold' : 'font-bold')}>{local(s.code, s.name)}</p>
                {s.platform && (
                  <p className="text-caption text-ink-muted">
                    {t('common.platform')} {s.platform}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="led text-[1.3rem]">{time}</p>
                {late > 0 && <p className={cn('text-caption font-bold', late >= 15 ? 'text-status-heavyDelay' : 'text-status-minorDelay')}>{t('common.late', { m: formatDelayMin(late, lang) })}</p>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
