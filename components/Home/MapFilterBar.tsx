'use client';

import { useMemo } from 'react';
import { Activity, Ban, ChevronRight, LocateFixed, MoveRight } from 'lucide-react';
import { LiveTrain } from '@/types/train';
import { sortTrainTypes, trainTypeColor, trainTypeLabel } from '@/lib/train-type';

export interface MapFilters {
  types: string[]; // empty = all types
  motion: 'all' | 'GPS' | 'STATION';
  speed: 'all' | 'moving' | 'stopped';
}

export const DEFAULT_FILTERS: MapFilters = { types: [], motion: 'all', speed: 'all' };

const MOTION_CHIPS: Array<{ key: MapFilters['motion']; label: string; icon: typeof MoveRight }> = [
  { key: 'all', label: 'All', icon: Activity },
  { key: 'GPS', label: 'Moving', icon: MoveRight },
  { key: 'STATION', label: 'At stn', icon: LocateFixed },
];

const SPEED_CHIPS: Array<{ key: MapFilters['speed']; label: string; icon: typeof MoveRight }> = [
  { key: 'all', label: 'Any speed', icon: Activity },
  { key: 'moving', label: 'Fast', icon: MoveRight },
  { key: 'stopped', label: 'Idle', icon: Ban },
];

interface MapFilterBarProps {
  trains: LiveTrain[];
  filters: MapFilters;
  onChange: (filters: MapFilters) => void;
}

export function MapFilterBar({ trains, filters, onChange }: MapFilterBarProps) {
  const { typeCounts, presentTypes, movingCount, fastCount, idleCount } = useMemo(() => {
    const typeCounts = new Map<string, number>();
    let movingCount = 0;
    let fastCount = 0;
    let idleCount = 0;
    for (const t of trains) {
      typeCounts.set(t.type, (typeCounts.get(t.type) ?? 0) + 1);
      if (t.src === 'GPS') movingCount += 1;
      const spd = t.spd ?? 0;
      if (spd >= 60) fastCount += 1;
      if (spd === 0 && t.src === 'STATION') idleCount += 1;
    }
    return {
      typeCounts,
      presentTypes: sortTrainTypes(Array.from(typeCounts.keys())),
      movingCount,
      fastCount,
      idleCount,
    };
  }, [trains]);

  const toggleType = (type: string) => {
    const has = filters.types.includes(type);
    const next = has
      ? filters.types.filter((t) => t !== type)
      : [...filters.types, type];
    onChange({ ...filters, types: next });
  };

  const chipBase =
    'flex shrink-0 items-center gap-1x rounded-pill border px-2x py-0.5x text-caption font-medium transition-colors';
  const activeChip = 'border-accent bg-accent/15 text-accent';
  const idleChip = 'border-ink/10 bg-surface-raised/60 text-ink-muted hover:border-ink/25 hover:text-ink';

  const edgeFade = {
    maskImage: 'linear-gradient(to right, black calc(100% - 28px), transparent)',
    WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 28px), transparent)',
  };

  return (
    <div className="flex flex-col gap-1x">
      <div className="relative">
        <div className="no-scrollbar flex items-center gap-1x overflow-x-auto pb-0.5x" style={edgeFade}>
          <button
            onClick={() => onChange({ ...filters, types: [] })}
            className={`${chipBase} ${filters.types.length === 0 ? activeChip : idleChip}`}
          >
            All
            <span className="tabular-nums text-label normal-case tracking-normal opacity-70">{trains.length}</span>
          </button>
          {presentTypes.map((type) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`${chipBase} ${filters.types.includes(type) ? activeChip : idleChip}`}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: trainTypeColor(type) }} />
              {trainTypeLabel(type)}
              <span className="tabular-nums text-label normal-case tracking-normal opacity-70">{typeCounts.get(type) ?? 0}</span>
            </button>
          ))}
          <span className="w-4x shrink-0" aria-hidden />
        </div>
        <span
          className="pointer-events-none absolute right-0 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-surface-raised/90 shadow-card"
          aria-hidden
        >
          <ChevronRight className="h-3.5 w-3.5 text-ink-muted" />
        </span>
      </div>

      <div className="relative">
        <div className="no-scrollbar flex items-center gap-1x overflow-x-auto" style={edgeFade}>
          {MOTION_CHIPS.map(({ key, label, icon: Icon }) => {
            const active = filters.motion === key;
            return (
              <button
                key={key}
                onClick={() => onChange({ ...filters, motion: active ? 'all' : key })}
                className={`${chipBase} ${active ? activeChip : idleChip}`}
              >
                <Icon className="h-3 w-3 shrink-0" aria-hidden />
                {label}
                <span className="tabular-nums text-label normal-case tracking-normal opacity-70">
                  {key === 'all' ? trains.length : key === 'GPS' ? movingCount : trains.length - movingCount}
                </span>
              </button>
            );
          })}
          <span className="mx-0.5x h-3 w-px shrink-0 bg-ink/15" aria-hidden />
          {SPEED_CHIPS.map(({ key, label, icon: Icon }) => {
            const active = filters.speed === key;
            return (
              <button
                key={key}
                onClick={() => onChange({ ...filters, speed: active ? 'all' : key })}
                className={`${chipBase} ${active ? activeChip : idleChip}`}
              >
                <Icon className="h-3 w-3 shrink-0" aria-hidden />
                {label}
                <span className="tabular-nums text-label normal-case tracking-normal opacity-70">
                  {key === 'all' ? trains.length : key === 'moving' ? fastCount : idleCount}
                </span>
              </button>
            );
          })}
          <span className="w-4x shrink-0" aria-hidden />
        </div>
        <span
          className="pointer-events-none absolute right-0 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-surface-raised/90 shadow-card"
          aria-hidden
        >
          <ChevronRight className="h-3.5 w-3.5 text-ink-muted" />
        </span>
      </div>
    </div>
  );
}
