'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Bell, Loader2, RefreshCcw, Search } from 'lucide-react';
import { useJourney } from '@/hooks/useJourney';
import { useRouteContext } from '@/hooks/useRouteContext';
import { useWeather } from '@/hooks/useWeather';
import { useTrainPhoto } from '@/hooks/useTrainPhoto';
import { MapCanvas } from '@/components/Map/MapCanvas';
import { BottomSheet } from '@/components/BottomSheet/BottomSheet';
import { TripStatBadge } from '@/components/TripStatBadge';
import { ElevationChart } from '@/components/ElevationChart';
import { ContextCard } from '@/components/ContextCard';
import { StationRow } from '@/components/StationRow';
import { StationTimeline } from '@/components/StationTimeline';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/Button';
import { getSunInfo } from '@/lib/sun';
import { useTimeTheme } from '@/lib/useTimeTheme';
import { todayInISTISO, TrainSchedule, CoachChart } from '@/lib/rail-schedule-types';
import { countdownText, secondsUntil, formatCountdown } from '@/lib/track-time';
import { CommandPalette } from '@/components/CommandPalette';
import { trainTypeColor, trainTypeLabel } from '@/lib/train-type';

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

function useCoachChart(trainNumber: string, originCode: string | undefined, runsOn: string[] | undefined) {
  const today = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
  }).format(new Date());
  const runsToday = !!runsOn && runsOn.includes(today);
  return useQuery({
    queryKey: ['coach-chart', trainNumber, originCode, todayInISTISO()],
    queryFn: async () => {
      if (!originCode || !runsToday) return null;
      const res = await fetch(
        `/api/coach-chart/${trainNumber}?station=${originCode}&date=${todayInISTISO()}`
      );
      if (!res.ok) return null;
      return (await res.json()) as CoachChart;
    },
    enabled: !!originCode && runsToday,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

function useLiveCountdown(hhmm: string | null | undefined): string | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!hhmm) return null;
  const s = secondsUntil(hhmm);
  return s === null ? null : formatCountdown(s);
}

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function RunsOnBadge({ runsOn }: { runsOn: string[] }) {
  if (runsOn.length === 0) return null;
  const set = new Set(runsOn);
  return (
    <div className="flex flex-wrap items-center gap-1x">
      <span className="text-xs font-medium text-ink-muted">Runs on</span>
      {DAY_ORDER.map((d) => (
        <span
          key={d}
          className={
            set.has(d)
              ? 'rounded-md bg-accent/15 px-1x py-0.5x text-[11px] font-semibold text-accent'
              : 'rounded-md px-1x py-0.5x text-[11px] text-ink-muted/50'
          }
        >
          {d}
        </span>
      ))}
    </div>
  );
}

function CoachOccupancy({ chart }: { chart: CoachChart }) {
  if (chart.coaches.length === 0) return null;
  const totalBerths = chart.coaches.reduce((acc, c) => acc + c.vacantBerths, 0);
  return (
    <div className="flex flex-col gap-1x rounded-card bg-surface-raised/60 p-2x">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Coach occupancy · {chart.trainNo}
        </p>
        <span className="text-xs tabular-nums text-ink-muted">
          {totalBerths} vacant
        </span>
      </div>
      <div className="flex flex-wrap gap-1x">
        {chart.coaches.map((c) => (
          <div
            key={c.coachName}
            className="flex min-w-[3.5rem] flex-col items-center rounded-lg border border-ink/10 bg-surface-raised px-1x py-0.5x"
            title={`${c.classCode} · pos ${c.positionFromEngine}`}
          >
            <span className="text-xs font-semibold tabular-nums">{c.coachName}</span>
            <span
              className={
                c.vacantBerths === 0
                  ? 'text-[10px] font-medium text-status-heavyDelay'
                  : c.vacantBerths <= 5
                    ? 'text-[10px] font-medium text-status-minorDelay'
                    : 'text-[10px] font-medium text-status-onTime'
              }
            >
              {c.vacantBerths} free
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreJourneyDashboard({
  countdown,
  origin,
  platform,
}: {
  countdown: string | null;
  origin: string | undefined;
  platform: string | undefined;
}) {
  const [reminder, setReminder] = useState(false);
  return (
    <div className="flex flex-col gap-2x rounded-card border border-accent/20 bg-accent/10 p-3x">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Not departed yet</p>
        <StatusPill status="not_started" delayMinutes={0} />
      </div>
      <div className="flex items-baseline gap-1x">
        <p className="text-3xl font-bold tabular-nums tracking-tight text-ink">
          {countdown ?? '—:—:—'}
        </p>
        <p className="text-sm text-ink-muted">to departure</p>
      </div>
      <p className="text-sm text-ink-muted">
        From {origin ?? 'origin'}
        {platform ? ` · Platform ${platform}` : ''}
      </p>
      <Button
        variant={reminder ? 'ghost' : 'primary'}
        onClick={() => setReminder((v) => !v)}
        className="self-start"
      >
        <Bell className="mr-1x h-4 w-4" aria-hidden />
        {reminder ? 'Reminder set' : 'Remind me'}
      </Button>
    </div>
  );
}

export function TrackingScreen({ trainNumber }: { trainNumber: string }) {
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { theme } = useTimeTheme();
  const { data: journey, isLoading, error, refetch } = useJourney(trainNumber);
  const { data: schedule } = useTrainSchedule(trainNumber);
  const photo = useTrainPhoto(trainNumber);

  const routeContext = useRouteContext(
    journey?.routeGeometry,
    journey?.totalDistanceKm ?? 0,
    trainNumber,
    !!journey
  );

  const weather = useWeather(
    journey?.currentLocation.lat,
    journey?.currentLocation.lng,
    !!journey
  );

  const coachChart = useCoachChart(trainNumber, journey?.origin.code, schedule?.trainRunsOn);

  const departureHHMM =
    journey?.status === 'not_started' ? journey.stations[0]?.scheduledDeparture : undefined;
  const liveCountdown = useLiveCountdown(departureHHMM);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2x bg-surface">
        <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden />
        <p className="text-sm text-ink-muted">Locating train…</p>
      </div>
    );
  }

  if (error || !journey) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2x bg-surface px-3x">
        <div className="glass flex w-full max-w-sm flex-col items-center gap-2x rounded-card p-4x text-center">
          <p className="text-base font-semibold">Couldn&apos;t load this train</p>
          <p className="text-sm text-ink-muted">Check the number and try again shortly.</p>
          <Button variant="ghost" onClick={() => refetch()}>
            <RefreshCcw className="mr-1x h-4 w-4" aria-hidden />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const sun = getSunInfo(journey.currentLocation.lat, journey.currentLocation.lng);
  const countdown = countdownText(journey);
  const typeColor = trainTypeColor(journey.type ?? '');

  const peekStatus = journey.status === 'not_started'
    ? liveCountdown
      ? `Departs in ${liveCountdown}`
      : 'Awaiting departure'
    : journey.status === 'completed'
      ? 'Journey complete'
      : null;

  const projected = journey.currentLocation.positionSource === 'projected';

  const heroImage = photo.data ? (
    <div className="relative h-44 w-full overflow-hidden rounded-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.data} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2x p-2x">
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-tight text-white">
            {journey.number} · {trainTypeLabel(journey.type ?? '')}
          </p>
          <p className="truncate text-sm font-medium text-white/90">{journey.name}</p>
          {journey.nameUnicode && (
            <p className="truncate text-xs text-white/70">{journey.nameUnicode}</p>
          )}
        </div>
        <StatusPill status={journey.status} delayMinutes={journey.delayMinutes} />
      </div>
    </div>
  ) : (
    <div
      className="relative h-36 w-full overflow-hidden rounded-card sm:h-44"
      style={{
        background: `linear-gradient(135deg, ${typeColor}26 0%, ${typeColor}0d 45%, transparent 75%)`,
      }}
    >
      <span
        className="absolute right-2x top-1/2 -translate-y-1/2 select-none text-7xl font-bold tabular-nums"
        style={{ color: `${typeColor}1a` }}
      >
        {journey.number}
      </span>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2x p-2x">
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-tight" style={{ color: typeColor }}>
            {journey.number} · {trainTypeLabel(journey.type ?? '')}
          </p>
          <p className="truncate text-sm font-medium">{journey.name}</p>
          {journey.nameUnicode && (
            <p className="truncate text-xs text-ink-muted">{journey.nameUnicode}</p>
          )}
        </div>
        <StatusPill status={journey.status} delayMinutes={journey.delayMinutes} />
      </div>
    </div>
  );

  const panelBody = (
    <div className="flex flex-col gap-3x">
      {heroImage}
      {schedule && <RunsOnBadge runsOn={schedule.trainRunsOn} />}
      {journey.status === 'not_started' && (
        <PreJourneyDashboard
          countdown={liveCountdown}
          origin={journey.origin?.name}
          platform={journey.stations[0]?.platform}
        />
      )}
      <div className="grid grid-cols-3 gap-1x">
        <TripStatBadge label="Complete" value={`${Math.round(journey.completionPercentage)}%`} />
        <TripStatBadge label="Remaining" value={`${Math.round(journey.remainingDistanceKm)} km`} />
        <TripStatBadge label="ETA" value={journey.ETA} />
      </div>
      {journey.nextStation && (
        <div>
          <p className="mb-1x text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Next stop
          </p>
          <StationRow station={journey.nextStation} />
        </div>
      )}
      {routeContext.data && routeContext.data.elevationProfile.length > 0 && (
        <ElevationChart points={routeContext.data.elevationProfile} />
      )}
      {coachChart.data && <CoachOccupancy chart={coachChart.data} />}
      <div className="flex flex-wrap gap-1x">
        {weather.data && <ContextCard variant="weather" weather={weather.data} />}
        <ContextCard variant="sun" sun={sun} />
        {routeContext.data?.terrainFeatures.slice(0, 4).map((f) => (
          <ContextCard key={`${f.type}-${f.name}`} variant="terrain" feature={f} />
        ))}
      </div>
      <div>
        <p className="mb-1x text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Stations · {journey.stations.length}
        </p>
        <StationTimeline stations={journey.stations} status={journey.status} />
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-surface">
      <MapCanvas journey={journey} theme={theme} weather={weather.data} />

      <nav
        aria-label="Page navigation"
        className="absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2x p-2x pt-[max(0.75rem,env(safe-area-inset-top))] lg:left-[calc(min(26rem,42vw)+0.5rem)]"
      >
        <button
          type="button"
          onClick={() => router.push('/')}
          className="glass flex items-center gap-1x rounded-pill px-2x py-1x text-sm font-medium text-ink transition-colors hover:text-accent"
          aria-label="Back to all trains on the map"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span>All trains</span>
        </button>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="glass flex items-center gap-1x rounded-pill px-2x py-1x text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          aria-label="Track another train"
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Track another</span>
          <span className="sm:hidden">Another</span>
          <kbd className="hidden rounded-md border border-ink-muted/20 bg-surface-raised/60 px-1x py-0.5x text-[10px] font-medium text-ink-muted md:inline">
            ⌘K
          </kbd>
        </button>
      </nav>

      <aside className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-[min(26rem,42vw)] items-center p-2x lg:flex">
        <div className="pointer-events-auto flex max-h-full w-full flex-col overflow-hidden rounded-card glass-strong">
          <div className="overflow-y-auto p-2x">
            {panelBody}
          </div>
        </div>
      </aside>

      <div className="lg:hidden">
        <BottomSheet
          peek={
            <div className="flex items-center justify-between gap-2x">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink-muted">
                  {journey.number} · {journey.name}
                </p>
                {peekStatus ? (
                  <p className="text-lg font-semibold">{peekStatus}</p>
                ) : projected ? (
                  <p className="text-sm font-semibold text-ink-muted">Projected position</p>
                ) : (
                  <div className="flex items-baseline gap-1x">
                    <p className="text-2xl font-semibold tabular-nums">{journey.speedKmh}</p>
                    <p className="text-sm text-ink-muted">km/h</p>
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5x">
                <StatusPill status={journey.status} delayMinutes={journey.delayMinutes} />
                {countdown && (
                  <span className="text-xs font-medium tabular-nums text-ink-muted">{countdown}</span>
                )}
              </div>
            </div>
          }
          half={<div className="mt-3x flex flex-col gap-3x">{panelBody}</div>}
        />
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
