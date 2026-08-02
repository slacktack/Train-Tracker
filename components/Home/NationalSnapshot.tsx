'use client';

import { useMemo } from 'react';
import { Gauge, Radio, TrainFront, Zap } from 'lucide-react';
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
    <div className="flex min-w-0 items-center gap-1.5x">
      <Icon className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
      <div className="min-w-0">
        <p className="truncate text-[10px] uppercase tracking-wide text-ink-muted">{label}</p>
        <p className="truncate font-display text-sm font-semibold tabular-nums text-ink">{value}</p>
        {sub && <p className="truncate text-[10px] text-ink-muted">{sub}</p>}
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
    <div className="glass flex items-center gap-3x overflow-x-auto no-scrollbar rounded-card px-2.5x py-1.5x">
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
          sub={`${stats.fastest.n} · ${stats.fastest.name.slice(0, 22)}`}
        />
      )}
    </div>
  );
}
