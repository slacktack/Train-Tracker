'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Armchair, ArrowRight, RefreshCcw, TrendingDown, TrendingUp, X } from 'lucide-react';
import { useJourney } from '@/hooks/useJourney';
import { useTrainPhoto } from '@/hooks/useTrainPhoto';
import { LiveTrain } from '@/types/train';
import { CoachChart, todayInISTISO, TrainSchedule } from '@/lib/rail-schedule-types';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { TripStatBadge } from '@/components/TripStatBadge';
import { StationRow } from '@/components/StationRow';
import { trainTypeColor, trainTypeLabel } from '@/lib/train-type';

interface TrainDetailCardProps {
  train: LiveTrain;
  onClose: () => void;
  onTrack: (trainNumber: string) => void;
}

function useCoachSummary(trainNumber: string, originCode: string | undefined) {
  return useQuery({
    queryKey: ['coach-summary', trainNumber, originCode, todayInISTISO()],
    queryFn: async (): Promise<CoachChart | null> => {
      if (!originCode) return null;
      const res = await fetch(`/api/coach-chart/${trainNumber}?station=${originCode}&date=${todayInISTISO()}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!originCode,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

function useTrainSchedule(trainNumber: string) {
  return useQuery({
    queryKey: ['schedule', trainNumber],
    queryFn: async () => {
      const res = await fetch(`/api/schedule/${trainNumber}`);
      if (!res.ok) return null;
      return (await res.json()) as TrainSchedule;
    },
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}

export function TrainDetailCard({ train, onClose, onTrack }: TrainDetailCardProps) {
  const [isMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
  );
  const { data: journey, isLoading, isError, refetch } = useJourney(train.n);
  const { data: schedule } = useTrainSchedule(train.n);
  // Cached schedule origin lets the coach chart load in parallel with the journey.
  const originCode = journey?.origin.code ?? schedule?.stationFrom;
  const { data: coachChart } = useCoachSummary(train.n, originCode);
  const { data: photoUrl } = useTrainPhoto(train.n);
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => {
    setPhotoFailed(false);
  }, [photoUrl]);
  const showPhoto = !!photoUrl && !photoFailed;
  const typeColor = trainTypeColor(train.type);
  const liveSpeed = journey?.speedKmh ?? train.spd ?? 0;
  const hasLiveData = !!journey && journey.stations.length > 0;
  const showSpeed = journey ? hasLiveData : (train.spd ?? 0) > 0;

  // Speed delta vs the previous poll: useJourney refetches every 18s, so the
  // latest journey object carries a fresh loco_speed. Comparing against the
  // previous render's value gives an accelerating/steady/braking indicator.
  // No delta until a real journey baseline exists — the feed's 0 for a stopped
  // train would otherwise fabricate a false "+127" when the first journey lands.
  const prevSpeedRef = useRef<number | null>(null);
  const [speedDelta, setSpeedDelta] = useState<number | null>(null);
  useEffect(() => {
    if (!journey || !hasLiveData) {
      prevSpeedRef.current = null;
      setSpeedDelta(null);
      return;
    }
    const prev = prevSpeedRef.current;
    prevSpeedRef.current = liveSpeed;
    if (prev !== null && prev !== liveSpeed) setSpeedDelta(liveSpeed - prev);
  }, [liveSpeed, journey, hasLiveData]);

  const coachSummary = (() => {
    if (!coachChart || coachChart.coaches.length === 0) return null;
    const total = coachChart.coaches.reduce((sum, c) => sum + c.vacantBerths, 0);
    if (total === 0) return null; // fully booked — a "0 vacant" row is noise
    const best = [...coachChart.coaches].sort((a, b) => b.vacantBerths - a.vacantBerths)[0];
    return { total, best };
  })();

  return (
    <motion.div
      initial={isMobile ? { y: 72, opacity: 0 } : { x: -32, opacity: 0 }}
      animate={{ x: 0, y: 0, opacity: 1 }}
      exit={isMobile ? { y: 72, opacity: 0 } : { x: -32, opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 320 }}
      className="glass flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-sheet shadow-glass sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-sheet"
    >
      <div className="mx-auto mt-1x h-1 w-9 shrink-0 rounded-full bg-ink-muted/25 sm:hidden" aria-hidden />
      <div
        className="relative shrink-0 overflow-hidden px-3x pb-3x pt-3x"
        style={{
          background: `linear-gradient(135deg, ${typeColor}26 0%, ${typeColor}0d 45%, transparent 75%)`,
        }}
      >
        <div className="flex items-start justify-between gap-2x">
          <div className="min-w-0">
            <p className="flex items-center gap-1x text-label" style={{ color: typeColor }}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: typeColor }} />
              {train.n} · {trainTypeLabel(train.type)}
            </p>
            <p className="mt-1x break-words text-subhead leading-snug">
              {journey?.name ?? train.name}
            </p>
            {journey?.nameUnicode && (
              <p className="break-words font-devanagari text-caption text-ink-muted">{journey.nameUnicode}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close train details"
            className="-mr-1x flex h-10 w-10 shrink-0 items-center justify-center rounded-pill text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {showPhoto ? (
          <div className="relative mt-2x h-32 overflow-hidden rounded-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt={`${journey?.name ?? train.name} ${train.n}`}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={() => setPhotoFailed(true)}
            />
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(to top, ${typeColor}40 0%, transparent 60%)` }}
            />
          </div>
        ) : (
          <div
            className="relative mt-2x flex h-20 items-center overflow-hidden rounded-card"
            style={{ background: `linear-gradient(135deg, ${typeColor}26 0%, ${typeColor}0d 45%, transparent 75%)` }}
          >
            <span
              className="absolute right-1x top-1/2 -translate-y-1/2 select-none font-display text-6xl font-bold tabular-nums"
              style={{ color: `${typeColor}1a` }}
              aria-hidden
            >
              {train.n}
            </span>
          </div>
        )}

        <div className="mt-2x flex items-center justify-between gap-2x">
          {isLoading ? (
            <span className="inline-flex items-center gap-1x text-caption text-ink-muted">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-muted/40" aria-hidden />
              Fetching live status…
            </span>
          ) : journey ? (
            <StatusPill status={journey.status} delayMinutes={journey.delayMinutes} />
          ) : (
            <p className="text-caption text-ink-muted">
              {train.src === 'GPS' ? 'Running' : 'At station'}
              {train.stn ? ` · ${train.stn}` : ''}
            </p>
          )}
          <div className="flex items-baseline gap-0.5x">
            {isLoading ? (
              <>
                <span className="h-8 w-12 animate-pulse rounded-md bg-ink-muted/10" />
                <span className="text-caption text-ink-muted">km/h</span>
              </>
            ) : showSpeed ? (
              <>
                <span className="font-display text-headline tabular-nums" style={{ color: typeColor }}>
                  {liveSpeed}
                </span>
                <span className="text-caption text-ink-muted">km/h</span>
                {liveSpeed === 0 && journey?.status !== 'completed' && journey?.status !== 'not_started' && (
                  <span className="ml-0.5x rounded-pill bg-ink-muted/10 px-1x text-label normal-case tracking-normal text-ink-muted">
                    Stopped
                  </span>
                )}
                {speedDelta !== null && speedDelta !== 0 && (
                  <span
                    className={`ml-0.5x flex items-center gap-0.5x rounded-pill px-1x text-label normal-case tracking-normal ${
                      speedDelta > 0
                        ? 'bg-status-onTime/15 text-status-onTime'
                        : 'bg-status-delayed/15 text-status-delayed'
                    }`}
                  >
                    {speedDelta > 0 ? (
                      <TrendingUp className="h-2.5 w-2.5" aria-hidden />
                    ) : (
                      <TrendingDown className="h-2.5 w-2.5" aria-hidden />
                    )}
                    {speedDelta > 0 ? '+' : ''}
                    {speedDelta}
                  </span>
                )}
              </>
            ) : (
              <span className="text-caption font-medium text-ink-muted">No live data</span>
            )}
          </div>
        </div>

        {coachSummary && (
          <div className="mt-2x flex items-center gap-1x rounded-card bg-surface-raised/70 px-2x py-1x">
            <Armchair className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
            <p className="min-w-0 flex-1 break-words text-caption leading-snug text-ink-muted">
              <span className="font-semibold text-ink">{coachSummary.total} vacant berths</span>
              {' · best '}
              <span className="font-medium" style={{ color: typeColor }}>
                {coachSummary.best.coachName} ({coachSummary.best.classCode})
              </span>{' '}
              with {coachSummary.best.vacantBerths} free
            </p>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3x">
        {isLoading && (
          <div className="flex flex-col gap-2x">
            <div className="grid grid-cols-2 gap-1x">
              <TripStatBadge
                label="Speed km/h"
                value={train.spd != null ? `${train.spd}` : '—'}
              />
              <TripStatBadge
                label="Status"
                value={train.src === 'GPS' ? 'Running' : `At ${train.stn ?? 'station'}`}
                className={train.src === 'GPS' ? '' : 'col-span-2'}
              />
              <TripStatBadge label="ETA" value="—" className="col-span-2" />
            </div>
            <p className="flex items-center gap-1x text-caption text-ink-muted">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-muted/40" aria-hidden />
              Fetching live status…
            </p>
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center gap-2x rounded-card bg-surface-raised p-3x text-center">
            <p className="text-sm text-ink-muted">Couldn&apos;t load live details.</p>
            <Button variant="ghost" onClick={() => refetch()}>
              <RefreshCcw className="mr-1x h-4 w-4" aria-hidden />
              Retry
            </Button>
          </div>
        )}

        {journey && !hasLiveData && (
          <div className="flex flex-col items-center gap-2x rounded-card bg-surface-raised/60 p-4x text-center">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ink-muted/40" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-ink-muted/40" />
            </span>
            <div>
              <p className="text-sm font-semibold">No live data yet</p>
              <p className="mt-0.5x text-caption text-ink-muted">
                This train isn&apos;t broadcasting live updates right now. Check back closer to
                departure.
              </p>
            </div>
          </div>
        )}

        {journey && hasLiveData && (
          <div className="flex flex-col gap-2x">
            <div className="grid grid-cols-2 gap-1x">
              <TripStatBadge
                label="Next stop"
                value={journey.nextStation ? journey.nextStation.code : journey.destination.code || '—'}
              />
              <TripStatBadge
                label="Delay"
                value={journey.delayMinutes > 0 ? `+${journey.delayMinutes}m` : 'On time'}
              />
              <TripStatBadge label="ETA" value={journey.ETA} className="col-span-2" />
            </div>

            <div>
              <div className="mb-1x flex items-center justify-between gap-1x text-caption text-ink-muted">
                <span className="min-w-0 flex-1 break-words">
                  {journey.origin.name || journey.origin.code || 'Origin'}
                </span>
                <span className="shrink-0 tabular-nums">
                  {Math.round(journey.completionPercentage)}%
                </span>
                <span className="min-w-0 flex-1 break-words text-right">
                  {journey.destination.name || journey.destination.code || 'Dest'}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-pill bg-ink-muted/15">
                <motion.div
                  className="h-full rounded-pill"
                  style={{ background: `linear-gradient(to right, ${typeColor}, ${typeColor}99)` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${journey.completionPercentage}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </div>

            {journey.currentStation && (
              <div className="flex items-center gap-2x rounded-card bg-surface-raised/60 px-2x py-1x text-sm">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                    style={{ backgroundColor: typeColor }}
                  />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: typeColor }} />
                </span>
                <span className="min-w-0 flex-1 break-words leading-snug">
                  <span className="text-ink-muted">At </span>
                  <span className="font-medium">{journey.currentStation.name}</span>
                  {journey.currentStation.platform && (
                    <span className="text-ink-muted"> · PF {journey.currentStation.platform}</span>
                  )}
                </span>
              </div>
            )}

            {journey.nextStation && (
              <div className="flex items-center gap-2x rounded-card bg-surface-raised/60 px-2x py-1x text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full border-2 border-ink-muted/30" />
                <span className="min-w-0 flex-1 break-words leading-snug">
                  <span className="text-ink-muted">Next </span>
                  <span className="font-medium">{journey.nextStation.name}</span>
                  <span className="text-ink-muted"> · arr {journey.nextStation.scheduledArrival}</span>
                </span>
              </div>
            )}

            {journey.stations.slice(0, 5).map((s) => (
              <StationRow key={s.code} station={s} />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-ink/10 bg-surface-raised/85 px-3x pt-2x pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-glass">
        <Button className="w-full" onClick={() => onTrack(train.n)}>
          Track this train
          <ArrowRight className="ml-1x h-4 w-4" aria-hidden />
        </Button>
      </div>
    </motion.div>
  );
}
