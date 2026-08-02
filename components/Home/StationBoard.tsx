'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Building2, X } from 'lucide-react';
import { LiveTrain, StationGroup } from '@/types/train';
import { trainTypeColor } from '@/lib/train-type';

interface StationBoardProps {
  station: StationGroup;
  onClose: () => void;
  onSelectTrain: (train: LiveTrain) => void;
}

export function StationBoard({ station, onClose, onSelectTrain }: StationBoardProps) {
  return (
    <motion.div
      initial={{ y: 32, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 32, opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 320 }}
      className="glass-strong flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-sheet sm:max-h-[70vh] sm:rounded-sheet"
    >
      <div className="mx-auto mt-1x h-1.5 w-10 shrink-0 rounded-full bg-ink-muted/30 sm:hidden" aria-hidden />
      <div className="flex items-start justify-between gap-2x border-b border-ink/[0.08] px-3x py-2x">
        <div className="min-w-0">
          <p className="flex items-center gap-1x text-label text-accent">
            <Building2 className="h-3.5 w-3.5" aria-hidden />
            {station.code || 'STATION'}
          </p>
          <p className="mt-0.5x break-words text-subhead">{station.name}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close station board"
          className="-mr-1x flex h-10 w-10 shrink-0 items-center justify-center rounded-pill text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2x pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {station.trains.length === 0 ? (
          <p className="px-2x py-4x text-center text-sm text-ink-muted">
            No active trains reported at this station right now.
          </p>
        ) : (
          <ul className="flex flex-col gap-1x">
            {station.trains.map((t) => (
              <li key={t.n}>
                <button
                  onClick={() => onSelectTrain(t)}
                  className="flex w-full items-start gap-2x rounded-card px-2x py-1.5x text-left transition-colors hover:bg-surface-raised"
                >
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: trainTypeColor(t.type) }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-body font-semibold">
                      {t.n} · {t.name}
                    </span>
                    <span className="block break-words text-caption text-ink-muted">
                      {t.src === 'GPS' ? 'Running' : 'At station'}
                      {t.spd ? ` · ${t.spd} km/h` : ''}
                      {t.stn && t.stn !== station.name ? ` · near ${t.stn}` : ''}
                    </span>
                  </span>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
