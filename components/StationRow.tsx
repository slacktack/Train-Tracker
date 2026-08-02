import { Station } from '@/types/train';
import { cn } from '@/lib/cn';

interface StationRowProps {
  station: Station;
}

export function StationRow({ station }: StationRowProps) {
  return (
    <div className="relative flex items-center justify-between py-2x pl-5x">
      {/* Glowing vertical rail: fades out at the top/bottom ends */}
      <span
        className="absolute bottom-0 left-[4px] top-0 w-[2px] bg-gradient-to-b from-ink-muted/40 via-ink-muted/15 to-ink-muted/40"
        aria-hidden
      />
      <div className="flex min-w-0 items-center gap-2x">
        <span
          className={cn(
            'absolute left-0 top-1/2 -translate-y-1/2 rounded-full',
            station.status === 'passed' && 'h-2.5 w-2.5 bg-ink-muted/40',
            station.status === 'current' &&
              'flex h-3 w-3 items-center justify-center shadow-[0_0_12px_2px_rgba(64,156,255,0.55)] dark:shadow-[0_0_16px_4px_rgba(64,156,255,0.5)]',
            station.status === 'upcoming' && 'h-3 w-3 border-2 border-ink-muted/40 bg-transparent'
          )}
        >
          {station.status === 'current' && (
            <>
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/40"
                aria-hidden
              />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
            </>
          )}
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              'truncate font-display text-sm font-medium',
              station.status === 'passed' && 'text-ink-muted/70'
            )}
          >
            {station.name}
          </p>
          {station.platform && <p className="text-xs text-ink-muted">Platform {station.platform}</p>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-sm tabular-nums">{station.actualArrival ?? station.scheduledArrival}</p>
        {station.delayMinutes > 0 && (
          <p className="font-mono text-xs text-status-minorDelay">+{station.delayMinutes}m</p>
        )}
      </div>
    </div>
  );
}
