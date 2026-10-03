'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Armchair, ArrowRight, RefreshCcw } from 'lucide-react';
import Link from 'next/link';
import { useJourney } from '@/hooks/useJourney';
import { LiveTrain } from '@/types/train';
import { CoachChart, todayInISTISO } from '@/lib/rail-schedule-types';
import { useT } from '@/lib/i18n/useT';
import { Button } from '@/components/ui/Button';
import { LoadingCue, LoadingSkeleton } from '@/components/ui/LoadingCue';
import { TrainHero } from '@/components/Journey/TrainHero';
import { WhereNowCard } from '@/components/Journey/WhereNowCard';
import { RouteDiagram } from '@/components/Journey/RouteDiagram';
import { trainTypeColor } from '@/lib/train-type';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useRecentsStore } from '@/store/useRecentsStore';

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

export function TrainDetailCard({ train, onClose, onTrack }: TrainDetailCardProps) {
  const { t } = useT();
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;
  const { data: journey, isLoading, isError, refetch } = useJourney(train.n);
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const pushRecent = useRecentsStore((s) => s.pushRecent);

  useEffect(() => {
    if (journey?.number) pushRecent({ number: journey.number, name: journey.name });
  }, [journey?.number, journey?.name, pushRecent]);

  const isFav = isFavorite(train.n);
  const { data: coachChart } = useCoachSummary(train.n, journey?.origin.code);
  const hasLiveData = !!journey && journey.stations.length > 0;
  const speed = journey?.speedKmh ?? train.spd ?? 0;
  const color = trainTypeColor(train.type);

  const coachSummary = (() => {
    if (!coachChart || coachChart.coaches.length === 0) return null;
    const total = coachChart.coaches.reduce((sum, c) => sum + c.vacantBerths, 0);
    if (total === 0) return null;
    const best = [...coachChart.coaches].sort((a, b) => b.vacantBerths - a.vacantBerths)[0];
    return { total, best };
  })();

  return (
    <motion.div
      initial={isMobile ? { y: 72, opacity: 0 } : { x: -32, opacity: 0 }}
      animate={{ x: 0, y: 0, opacity: 1 }}
      exit={isMobile ? { y: 72, opacity: 0 } : { x: -32, opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 320 }}
      className="glass-strong flex max-h-[58dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-sheet sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-2xl"
    >
      <TrainHero
        number={train.n}
        name={journey?.name ?? train.name}
        nameUnicode={journey?.nameUnicode}
        type={train.type}
        speedKmh={speed}
        showSpeed={journey ? hasLiveData && journey.status !== 'not_started' : speed > 0}
        isFav={isFav}
        onFav={() => toggleFavorite({ number: train.n, name: journey?.name ?? train.name })}
        onClose={onClose}
      />

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3.5">
        {isLoading && (
          <div className="space-y-2" role="status" aria-label={t('common.loading')}>
            <LoadingCue size="block" label={t('common.loading')} />
            <LoadingSkeleton className="h-16 w-full" />
            <LoadingSkeleton className="h-10 w-full" />
            <LoadingSkeleton className="h-10 w-3/4" />
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-ink/20 p-4 text-center">
            <p className="text-body text-ink-muted">{t('common.couldntLoad')}</p>
            <Button variant="ghost" onClick={() => refetch()}>
              <RefreshCcw className="mr-1.5 h-4 w-4" aria-hidden />
              {t('common.retry')}
            </Button>
          </div>
        )}

        {journey && hasLiveData && (
          <>
            <WhereNowCard journey={journey} />

            <div>
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-ink/15" role="progressbar" aria-valuenow={Math.round(journey.completionPercentage)} aria-valuemin={0} aria-valuemax={100}>
                <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${journey.completionPercentage}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} />
              </div>
              <p className="mt-1.5 flex justify-between text-caption font-semibold text-ink-muted">
                <span>{Math.round(journey.completionPercentage)}%</span>
                <span>
                  {Math.round(journey.remainingDistanceKm)} {t('common.km')}
                </span>
              </p>
            </div>

            {coachSummary && (
              <p className="flex items-center gap-2 rounded-lg border border-ink/15 px-3 py-2 text-caption text-ink-muted">
                <Armchair className="h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0 break-words">
                  <b className="text-ink">{t('seats.free', { n: coachSummary.total })}</b> · {coachSummary.best.coachName} ({coachSummary.best.classCode}): {t('seats.free', { n: coachSummary.best.vacantBerths })}
                </span>
              </p>
            )}

            <RouteDiagram journey={journey} />
          </>
        )}

        {journey && !hasLiveData && (
          <p className="rounded-lg border border-dashed border-ink/30 p-4 text-center text-body text-ink-muted">{t('card.notStarted')}</p>
        )}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-ink/15 bg-surface-elevated/90 px-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <Button className="flex-1" onClick={() => onTrack(train.n)}>
          {t('card.track')}
          <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
        </Button>
        <Link
          href={`/track/${train.n}/seats?station=${journey?.origin.code ?? ''}&date=${todayInISTISO()}`}
          aria-label={t('card.seats')}
          className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-pill border border-ink/30 text-ink-muted hover:text-ink"
        >
          <Armchair className="h-5 w-5" aria-hidden />
        </Link>
      </div>
    </motion.div>
  );
}
