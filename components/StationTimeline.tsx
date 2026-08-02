'use client';

import { useMemo, useState } from 'react';
import { Station } from '@/types/train';
import { cn } from '@/lib/cn';

const COLLAPSE_AFTER = 8;

interface StationTimelineProps {
  stations: Station[];
  status: string;
}

type StationRole = 'origin' | 'here' | 'next' | 'then' | 'passed' | 'destination' | 'upcoming';

function roleForStation(
  station: Station,
  index: number,
  stations: Station[],
  journeyStatus: string,
  nextIndex: number | null
): StationRole {
  const isFirst = index === 0;
  const isLast = index === stations.length - 1;

  if (station.status === 'current') return 'here';
  if (station.status === 'passed') {
    if (isFirst && journeyStatus !== 'completed') return 'origin';
    return 'passed';
  }
  // upcoming
  if (isLast && journeyStatus !== 'not_started') return 'destination';
  if (nextIndex !== null && index === nextIndex) return 'next';
  if (nextIndex !== null && index === nextIndex + 1) return 'then';
  if (isFirst && journeyStatus === 'not_started') return 'origin';
  return 'upcoming';
}

const ROLE_COPY: Record<StationRole, string | null> = {
  origin: 'Origin',
  here: 'You are here',
  next: 'Next stop',
  then: 'Then',
  passed: null,
  destination: 'Destination',
  upcoming: null,
};

export function StationTimeline({ stations, status }: StationTimelineProps) {
  const [expanded, setExpanded] = useState(false);

  const nextIndex = useMemo(() => {
    const currentIdx = stations.findIndex((s) => s.status === 'current');
    if (currentIdx >= 0) {
      const after = stations.findIndex((s, i) => i > currentIdx && s.status === 'upcoming');
      return after >= 0 ? after : null;
    }
    // Not yet departed — first upcoming is next
    const firstUpcoming = stations.findIndex((s) => s.status === 'upcoming' || s.status === 'current');
    return firstUpcoming >= 0 ? firstUpcoming : null;
  }, [stations]);

  const shown = expanded ? stations : stations.slice(0, COLLAPSE_AFTER);

  // Narration strip: one-line story above the list when the train is mid-journey
  const narration = useMemo(() => {
    const current = stations.find((s) => s.status === 'current');
    const next = nextIndex !== null ? stations[nextIndex] : undefined;
    const then =
      nextIndex !== null && nextIndex + 1 < stations.length
        ? stations[nextIndex + 1]
        : undefined;

    if (status === 'not_started') {
      const first = stations[0];
      return first
        ? `Departs from ${first.name}${first.scheduledDeparture ? ` at ${first.scheduledDeparture}` : ''}`
        : null;
    }
    if (status === 'completed') {
      const last = stations[stations.length - 1];
      return last ? `Arrived at ${last.name}` : null;
    }
    if (current && next) {
      return then
        ? `Now at ${current.name} → next ${next.name} → then ${then.name}`
        : `Now at ${current.name} → next ${next.name}`;
    }
    if (!current && next) {
      return then
        ? `Next ${next.name} → then ${then.name}`
        : `Next stop: ${next.name}`;
    }
    if (current) return `Now at ${current.name}`;
    return null;
  }, [stations, nextIndex, status]);

  return (
    <div className="flex flex-col gap-2x">
      {narration && (
        <div className="rounded-card border border-accent/15 bg-accent/[0.07] px-2x py-1.5x">
          <p className="text-label text-accent">Journey story</p>
          <p className="mt-0.5x break-words text-body font-medium leading-snug text-ink">
            {narration}
          </p>
        </div>
      )}

      <div className="flex flex-col">
        {shown.map((s, i) => {
          const role = roleForStation(s, i, stations, status, nextIndex);
          const roleLabel = ROLE_COPY[role];
          const isHere = role === 'here';
          const isNext = role === 'next';
          const isThen = role === 'then';
          const isOrigin = role === 'origin';
          const isDest = role === 'destination';
          const isPassed = role === 'passed' || (s.status === 'passed' && !isOrigin);

          return (
            <div
              key={s.code}
              className={cn(
                'relative flex gap-2x pb-3x pl-6x last:pb-0',
                (isHere || isNext) && '-mx-1x rounded-card px-1x py-1x',
                isHere && 'bg-accent/[0.08]',
                isNext && 'bg-surface-raised/80'
              )}
            >
              <span
                className={cn(
                  'absolute bottom-0 left-[7px] top-3 w-[2px]',
                  isPassed || isOrigin
                    ? 'bg-ink-muted/25'
                    : isHere
                      ? 'bg-gradient-to-b from-accent via-accent/40 to-ink-muted/15'
                      : 'bg-ink-muted/15'
                )}
                aria-hidden
              />
              <span
                className={cn(
                  'absolute left-0 top-[6px] h-4 w-4 rounded-full border-2',
                  isHere
                    ? 'animate-pulse border-accent bg-accent/25 shadow-[0_0_14px_3px_rgba(99,102,241,0.45)]'
                    : isOrigin
                      ? 'border-status-onTime bg-status-onTime/25 shadow-[0_0_12px_2px_rgba(16,185,129,0.35)]'
                      : isDest
                        ? 'border-status-heavyDelay bg-transparent'
                        : isNext
                          ? 'border-accent bg-accent/15'
                          : isPassed
                            ? 'border-ink-muted/40 bg-ink-muted/40'
                            : 'border-ink-muted/30 bg-transparent'
                )}
              />
              <div className="flex min-w-0 flex-1 items-start justify-between gap-2x">
                <div className="min-w-0">
                  {roleLabel && (
                    <p
                      className={cn(
                        'mb-0.5x text-label',
                        isHere || isNext ? 'text-accent' : isOrigin ? 'text-status-onTime' : 'text-ink-muted'
                      )}
                    >
                      {roleLabel}
                    </p>
                  )}
                  <p
                    className={cn(
                      'break-words text-body font-medium leading-snug',
                      isPassed && !isOrigin && 'text-ink-muted',
                      isHere && 'font-semibold text-ink',
                      isNext && 'font-semibold text-ink'
                    )}
                  >
                    {s.name}
                  </p>
                  <p className="text-caption text-ink-muted">
                    {s.platform ? `PF ${s.platform}` : s.code}
                    {isThen && ' · after next'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      'text-body tabular-nums',
                      isHere && 'font-semibold text-accent',
                      isNext && 'font-semibold'
                    )}
                  >
                    {s.actualArrival ?? s.scheduledArrival}
                  </p>
                  {s.delayMinutes > 0 && (
                    <p className="text-caption text-status-minorDelay">+{s.delayMinutes}m</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {stations.length > COLLAPSE_AFTER && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1x self-start rounded-full px-2x py-1x text-caption font-semibold text-accent transition-colors hover:bg-accent/10"
          >
            {expanded ? 'Show fewer' : `View all ${stations.length} stations`}
          </button>
        )}
      </div>
    </div>
  );
}
