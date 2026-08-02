'use client';

import { useMemo } from 'react';
import { ChevronRight, Gauge, Radio, TrainFront, Zap } from 'lucide-react';
import { LiveTrain } from '@/types/train';

interface NationalSnapshotProps {
  trains: LiveTrain[];
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Radio;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex w-[7.5rem] shrink-0 items-center gap-1.5x sm:w-32">
      <Icon className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
      <div className="min-w-0">
        <p className="text-label text-ink-muted">{label}</p>
        <p className="break-words font-display text-body font-semibold tabular-nums text-ink">{value}</p>
        {sub && <p className="break-words text-label normal-case tracking-normal text-ink-muted">{sub}</p>}
      </div>
    </div>
  );
}

export function NationalSnapshot({ trains }: NationalSnapshotProps) {
  const stats = useMemo(() => {
    const count = trains.length;
    const gps = trains.filter((t) => t.src === 'GPS');
    const movingPct = count === 0 ? 0 : Math.round((gps.length / count) * 100);
    const withSpeed = trains.filter((t) => (t.spd ?? 0) > 0);
    const avgSpeed = withSpeed.length === 0
      ? 0
      : Math.round(withSpeed.reduce((sum, t) => sum + (t.spd ?? 0), 0) / withSpeed.length);
    const fastest = withSpeed.reduce<LiveTrain | null>(
      (best, t) => (!best || (t.spd ?? 0) > (best.spd ?? 0) ? t : best),
      null
    );
    return { count, movingPct, avgSpeed, fastest, withSpeedCount: withSpeed.length };
  }, [trains]);

  return (
    <div className="glass relative rounded-card ring-1 ring-inset ring-ink/[0.04]">
      <div
        className="flex items-center gap-3x overflow-x-auto no-scrollbar rounded-card py-1.5x pl-2.5x pr-6x"
        style={{ maskImage: 'linear-gradient(to right, black calc(100% - 40px), transparent)', WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 40px), transparent)' }}
      >
        <Stat icon={TrainFront} label="Live" value={new Intl.NumberFormat('en-IN').format(stats.count)} />
        <span className="h-6 w-px shrink-0 bg-ink/10" aria-hidden />
        <Stat icon={Radio} label="Moving" value={`${stats.movingPct}%`} sub={`${new Intl.NumberFormat('en-IN').format(Math.round(stats.count * stats.movingPct / 100))} trains`} />
        <span className="h-6 w-px shrink-0 bg-ink/10" aria-hidden />
        <Stat icon={Gauge} label="Avg speed" value={`${stats.avgSpeed} km/h`} sub={`${stats.withSpeedCount} sampled`} />
        <span className="h-6 w-px shrink-0 bg-ink/10" aria-hidden />
        {stats.fastest && (
          <Stat
            icon={Zap}
            label="Fastest"
            value={`${stats.fastest.spd} km/h`}
            sub={`${stats.fastest.n} · ${stats.fastest.name}`}
          />
        )}
      </div>
      <span
        className="pointer-events-none absolute right-1x top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-surface-raised/90 shadow-card"
        aria-hidden
      >
        <ChevronRight className="h-3.5 w-3.5 text-ink-muted" />
      </span>
    </div>
  );
}
