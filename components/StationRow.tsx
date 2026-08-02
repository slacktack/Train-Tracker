import { Station } from '@/types/train';
import { cn } from '@/lib/cn';

interface StationRowProps {
  station: Station;
}

const STATUS_LABEL: Record<Station['status'], string | null> = {
  current: 'You are here',
  passed: null,
  upcoming: null,
};

export function StationRow({ station }: StationRowProps) {
  const roleLabel = STATUS_LABEL[station.status];
  const isHere = station.status === 'current';

  return (
    <div
      className={cn(
        'relative flex items-center justify-between py-2x pl-6x',
        isHere && 'rounded-card bg-accent/[0.07] pr-1x'
      )}
    >
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
            isHere &&
              'flex h-3 w-3 items-center justify-center shadow-[0_0_12px_2px_rgba(99,102,241,0.5)]',
            station.status === 'upcoming' && 'h-3 w-3 border-2 border-ink-muted/40 bg-transparent'
          )}
        >
          {isHere && (
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
          {roleLabel && (
            <p className="mb-0.5x text-label text-accent">{roleLabel}</p>
          )}
          <p
            className={cn(
              'break-words font-display text-body font-medium leading-snug',
              station.status === 'passed' && 'text-ink-muted/70',
              isHere && 'font-semibold'
            )}
          >
            {station.name}
          </p>
          {station.platform && <p className="text-caption text-ink-muted">Platform {station.platform}</p>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={cn(
            'text-body tabular-nums',
            isHere && 'font-semibold text-accent'
          )}
        >
          {station.actualArrival ?? station.scheduledArrival}
        </p>
        {station.delayMinutes > 0 && (
          <p className="text-caption text-status-minorDelay">+{station.delayMinutes}m</p>
        )}
      </div>
    </div>
  );
}
