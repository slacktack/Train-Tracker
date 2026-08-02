'use client';

import { useState } from 'react';
import { Station } from '@/types/train';
import { cn } from '@/lib/cn';

const COLLAPSE_AFTER = 8;

interface StationTimelineProps {
  stations: Station[];
  status: string;
}

export function StationTimeline({ stations, status }: StationTimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? stations : stations.slice(0, COLLAPSE_AFTER);

  return (
    <div className="flex flex-col">
      {shown.map((s, i) => {
        const isOrigin = i === 0 && status !== 'completed';
        const isDest = i === stations.length - 1 && status !== 'not_started';
        const isCurrent = s.status === 'current';
        const isPassed = s.status === 'passed';
        return (
          <div key={s.code} className="relative flex gap-2x pb-3x pl-6x last:pb-0">
            <span className="absolute bottom-0 left-[7px] top-3 w-[2px] bg-ink-muted/15" aria-hidden />
            <span
              className={cn(
                'absolute left-0 top-[6px] h-4 w-4 rounded-full border-2',
                isCurrent
                  ? 'animate-pulse border-accent bg-accent/25 shadow-[0_0_14px_3px_rgba(64,156,255,0.5)]'
                  : isOrigin
                    ? 'border-status-onTime bg-status-onTime/25 shadow-[0_0_12px_2px_rgba(52,199,89,0.4)]'
                    : isDest
                      ? 'border-status-heavyDelay bg-transparent'
                      : isPassed
                        ? 'border-ink-muted/40 bg-ink-muted/40'
                        : 'border-ink-muted/30 bg-transparent'
              )}
            />
            <div className="flex min-w-0 flex-1 items-start justify-between gap-2x">
              <div className="min-w-0">
                <p
                  className={cn(
                    'break-words text-body font-medium leading-snug',
                    isPassed && !isOrigin && 'text-ink-muted'
                  )}
                >
                  {s.name}
                </p>
                <p className="text-caption text-ink-muted">
                  {s.platform ? `PF ${s.platform}` : s.code}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={cn(
                    'text-body tabular-nums',
                    isCurrent && 'font-semibold text-accent'
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
          {expanded
            ? 'Show fewer'
            : `View all ${stations.length} stations`}
        </button>
      )}
    </div>
  );
}
