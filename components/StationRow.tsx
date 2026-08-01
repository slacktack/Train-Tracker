import { Station } from '@/types/train';
import { cn } from '@/lib/cn';

interface StationRowProps {
  station: Station;
}

export function StationRow({ station }: StationRowProps) {
  return (
    <div className="flex items-center justify-between border-b border-ink-muted/10 py-1x">
      <div className="flex items-center gap-1x">
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            station.status === 'passed' && 'bg-ink-muted/40',
            station.status === 'current' && 'bg-accent animate-pulse',
            station.status === 'upcoming' && 'bg-ink-muted/20'
          )}
        />
        <div>
          <p className="text-sm font-medium">{station.name}</p>
          {station.platform && <p className="text-xs text-ink-muted">Platform {station.platform}</p>}
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm tabular-nums">{station.actualArrival ?? station.scheduledArrival}</p>
        {station.delayMinutes > 0 && (
          <p className="text-xs text-status-minorDelay">+{station.delayMinutes}m</p>
        )}
      </div>
    </div>
  );
}
