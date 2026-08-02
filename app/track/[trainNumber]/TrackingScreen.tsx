'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Bell, Gauge, Loader2, RefreshCcw, Search } from 'lucide-react';
import { useJourney } from '@/hooks/useJourney';
import { useRouteContext } from '@/hooks/useRouteContext';
import { useWeather } from '@/hooks/useWeather';
import { useTrainPhoto } from '@/hooks/useTrainPhoto';
import { MapCanvas } from '@/components/Map/MapCanvas';
import { BottomSheet } from '@/components/BottomSheet/BottomSheet';
import { TripStatBadge } from '@/components/TripStatBadge';
import { ElevationChart } from '@/components/ElevationChart';
import { ContextCard } from '@/components/ContextCard';
import { StationTimeline } from '@/components/StationTimeline';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/Button';
import { CircularGauge } from '@/components/ui/CircularGauge';
import { getSunInfo } from '@/lib/sun';
import { useTimeTheme } from '@/lib/useTimeTheme';
import { todayInISTISO, TrainSchedule, CoachChart } from '@/lib/rail-schedule-types';
import { countdownText, secondsUntil, formatCountdown } from '@/lib/track-time';
import { CommandPalette } from '@/components/CommandPalette';
import { useTrackingStore } from '@/store/useTrackingStore';
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
    <div className="flex flex-col gap-0.5x">
      <span className="text-label text-ink-muted">Runs on</span>
      <div className="flex flex-wrap items-center gap-1x">
        {DAY_ORDER.map((d) => (
          <span
            key={d}
            className={
              set.has(d)
                ? 'rounded-md bg-accent/15 px-1x py-0.5x text-caption font-semibold text-accent'
                : 'rounded-md px-1x py-0.5x text-caption text-ink-muted/50'
            }
          >
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}

function CoachOccupancy({ chart }: { chart: CoachChart }) {
  if (chart.coaches.length === 0) return null;
  const totalBerths = chart.coaches.reduce((acc, c) => acc + c.vacantBerths, 0);
  return (
    <div className="flex flex-col gap-1x rounded-card bg-surface-raised/60 p-2x">
      <div className="flex items-center justify-between">
        <p className="text-label text-ink-muted">
          Coach occupancy · {chart.trainNo}
        </p>
        <span className="text-caption tabular-nums text-ink-muted">
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
            <span className="text-caption font-semibold tabular-nums">{c.coachName}</span>
            <span
              className={
                c.vacantBerths === 0
                  ? 'text-label normal-case tracking-normal text-status-heavyDelay'
                  : c.vacantBerths <= 5
                    ? 'text-label normal-case tracking-normal text-status-minorDelay'
                    : 'text-label normal-case tracking-normal text-status-onTime'
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
        <p className="text-label text-accent">Not departed yet</p>
        <StatusPill status="not_started" delayMinutes={0} />
      </div>
      <div className="flex items-baseline gap-1x">
        <p className="text-headline tabular-nums tracking-tight text-ink">
          {countdown ?? '—:—:—'}
        </p>
        <p className="text-body text-ink-muted">to departure</p>
      </div>
      <p className="text-body text-ink-muted">
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
  const { sheetState } = useTrackingStore();
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
        <p className="text-body text-ink-muted">Locating train…</p>
      </div>
    );
  }

  if (error || !journey) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2x bg-surface px-3x">
        <div className="glass flex w-full max-w-sm flex-col items-center gap-2x rounded-card p-4x text-center">
          <p className="text-base font-semibold">Couldn&apos;t load this train</p>
          <p className="text-body text-ink-muted">Check the number and try again shortly.</p>
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

  const updatedText = (() => {
    const raw = journey.lastUpdated;
    if (!raw) return '—';
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata',
      });
    }
    return raw;
  })();

  const heroImage = photo.data ? (
    <div className="relative h-28 w-full overflow-hidden rounded-card sm:h-32">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.data} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2x p-2x">
        <div className="min-w-0">
          <p className="break-words text-subhead leading-tight text-white">
            {journey.number} · {trainTypeLabel(journey.type ?? '')}
          </p>
          <p className="break-words text-body font-medium leading-snug text-white/90">{journey.name}</p>
          {journey.nameUnicode && (
            <p className="break-words font-devanagari text-caption leading-snug text-white/70">{journey.nameUnicode}</p>
          )}
        </div>
        <StatusPill status={journey.status} delayMinutes={journey.delayMinutes} />
      </div>
    </div>
  ) : (
    <div
      className="relative h-24 w-full overflow-hidden rounded-card sm:h-28"
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
          <p className="break-words text-subhead leading-tight" style={{ color: typeColor }}>
            {journey.number} · {trainTypeLabel(journey.type ?? '')}
          </p>
          <p className="break-words text-body font-medium leading-snug">{journey.name}</p>
          {journey.nameUnicode && (
            <p className="break-words font-devanagari text-caption leading-snug text-ink-muted">{journey.nameUnicode}</p>
          )}
        </div>
        <StatusPill status={journey.status} delayMinutes={journey.delayMinutes} />
      </div>
    </div>
  );

  const panelBody = (
    <div className="flex flex-col gap-2x">
      {heroImage}
      {schedule && <RunsOnBadge runsOn={schedule.trainRunsOn} />}
      {journey.status === 'not_started' && (
        <PreJourneyDashboard
          countdown={liveCountdown}
          origin={journey.origin?.name}
          platform={journey.stations[0]?.platform}
        />
      )}

      {/* "Where is my train right now" — the single most-asked question —
          leads the panel instead of being buried below stats and speed. */}
      <div className="flex flex-col gap-1x">
        <div className="flex items-center justify-between gap-1.5x rounded-card bg-surface-raised px-2x py-1x shadow-card">
          <span className="min-w-0 flex-1 break-words text-body font-semibold leading-snug">
            {journey.origin.name}
          </span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
          <span className="min-w-0 flex-1 break-words text-right text-body font-semibold leading-snug">
            {journey.destination.name}
          </span>
        </div>

        {journey.currentStation && (
          <div className="flex items-center gap-2x rounded-card bg-surface-raised px-2x py-1x text-body">
            <span className="relative flex h-2 w-2 shrink-0">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                style={{ backgroundColor: typeColor }}
              />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ backgroundColor: typeColor }}
              />
            </span>
            <span className="min-w-0 flex-1 break-words leading-snug">
              <span className="text-ink-muted">At </span>
              <span className="font-medium">{journey.currentStation.name}</span>
              {journey.currentStation.platform && (
                <span className="text-ink-muted"> · PF {journey.currentStation.platform}</span>
              )}
            </span>
            {journey.currentStation.scheduledDeparture && (
              <span className="shrink-0 text-caption tabular-nums text-ink-muted">
                dep {journey.currentStation.actualDeparture ?? journey.currentStation.scheduledDeparture}
              </span>
            )}
          </div>
        )}

        {journey.nextStation && (
          <div className="flex items-center gap-2x rounded-card bg-surface-raised px-2x py-1x text-body">
            <span className="h-2 w-2 shrink-0 rounded-full border-2 border-ink-muted/30" />
            <span className="min-w-0 flex-1 break-words leading-snug">
              <span className="text-ink-muted">Next </span>
              <span className="font-medium">{journey.nextStation.name}</span>
              <span className="text-ink-muted"> · arr {journey.nextStation.scheduledArrival}</span>
            </span>
            <span className="shrink-0 text-caption tabular-nums text-ink-muted">
              {journey.nextStation.distanceKm ? `${journey.nextStation.distanceKm} km` : ''}
            </span>
          </div>
        )}

        <div className="mt-0.5x h-1.5 overflow-hidden rounded-pill bg-ink-muted/15">
          <div
            className="h-full rounded-pill bg-accent transition-[width] duration-700 ease-out"
            style={{ width: `${journey.completionPercentage}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-1x text-caption text-ink-muted">
          <span className="min-w-0 flex-1 break-words">{journey.origin.code}</span>
          <span className="shrink-0 font-medium tabular-nums text-ink">
            {Math.round(journey.completionPercentage)}%
          </span>
          <span className="min-w-0 flex-1 break-words text-right">{journey.destination.code}</span>
        </div>
      </div>

      {/* Current conditions right under "where is my train" — no scrolling
          needed to see what's happening around it right now. */}
      <div className="grid grid-cols-2 gap-1x">
        {weather.isLoading ? (
          <div className="h-24 animate-pulse rounded-card bg-surface-raised/60" aria-hidden />
        ) : (
          weather.data && <ContextCard variant="weather" weather={weather.data} />
        )}
        <ContextCard variant="sun" sun={sun} />
        {routeContext.data?.terrainFeatures.slice(0, 4).map((f) => (
          <ContextCard key={`${f.type}-${f.name}`} variant="terrain" feature={f} />
        ))}
      </div>

      {routeContext.isLoading ? (
        <div className="h-[148px] animate-pulse rounded-card bg-surface-raised/60" aria-hidden />
      ) : (
        routeContext.data &&
        routeContext.data.elevationProfile.length > 0 && (
          <ElevationChart
            points={routeContext.data.elevationProfile}
            currentKm={(journey.completionPercentage / 100) * journey.totalDistanceKm}
          />
        )
      )}

      <div className="grid grid-cols-2 gap-1x">
        <TripStatBadge
          label="Delay"
          value={journey.delayMinutes > 0 ? `+${journey.delayMinutes}m` : 'On time'}
          tone={journey.delayMinutes >= 15 ? 'bad' : journey.delayMinutes >= 1 ? 'warn' : 'good'}
        />
        <TripStatBadge label="ETA" value={journey.ETA} />
        <TripStatBadge label="Covered" value={`${Math.round(journey.distanceCoveredKm)} km`} />
        <TripStatBadge label="Remaining" value={`${Math.round(journey.remainingDistanceKm)} km`} />
        <TripStatBadge label="Complete" value={`${Math.round(journey.completionPercentage)}%`} />
        <TripStatBadge label="Updated" value={updatedText} />
      </div>

      <div className="flex items-center justify-between gap-2x rounded-card bg-surface-raised px-2x py-1.5x shadow-card">
        <div className="flex min-w-0 items-center gap-2x">
          <CircularGauge value={journey.speedKmh} max={140} size={72} strokeWidth={6} color={typeColor}>
            <div className="flex flex-col items-center">
              <span className="font-display text-subhead leading-none tabular-nums">{journey.speedKmh}</span>
              <span className="text-[10px] leading-none text-ink-muted">km/h</span>
            </div>
          </CircularGauge>
          <div className="min-w-0">
            <p className="flex items-center gap-1x text-caption text-ink-muted">
              <Gauge className="h-3.5 w-3.5 text-accent" aria-hidden />
              Speed
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5x">
          {projected ? (
            <span className="rounded-pill bg-ink-muted/10 px-1x py-0.5x text-label text-ink-muted">
              Projected
            </span>
          ) : journey.currentLocation.isMoving ? (
            <span className="flex items-center gap-1x text-caption font-medium text-status-onTime">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-onTime opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-status-onTime" />
              </span>
              Moving
            </span>
          ) : (
            <span className="flex items-center gap-1x text-caption font-medium text-status-heavyDelay">
              <span className="h-1.5 w-1.5 rounded-full bg-status-heavyDelay" />
              Stopped
            </span>
          )}
          {journey.stale && (
            <span className="text-label normal-case tracking-normal text-ink-muted">stale · retrying</span>
          )}
        </div>
      </div>

      <div>
        <p className="mb-1x text-label text-ink-muted">
          Stations · {journey.stations.length}
        </p>
        <StationTimeline stations={journey.stations} status={journey.status} />
      </div>

      {coachChart.isLoading ? (
        <div className="h-16 animate-pulse rounded-card bg-surface-raised/60" aria-hidden />
      ) : (
        coachChart.data && <CoachOccupancy chart={coachChart.data} />
      )}
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
          className="glass flex items-center gap-1x rounded-pill px-2x py-1x text-body font-semibold text-ink transition-colors hover:text-accent"
          aria-label="Back to all trains on the map"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span>All trains</span>
        </button>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="glass flex items-center gap-1x rounded-pill px-2x py-1x text-body font-semibold text-ink-muted transition-colors hover:text-ink"
          aria-label="Track another train"
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Track another</span>
          <span className="sm:hidden">Another</span>
          <kbd className="hidden rounded-md border border-ink-muted/20 bg-surface-raised/60 px-1x py-0.5x text-label normal-case tracking-normal text-ink-muted md:inline">
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
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 z-[15] bg-black transition-opacity duration-300 ${
            sheetState !== 'peek' ? 'opacity-40' : 'opacity-0'
          }`}
        />
        <BottomSheet
          peek={
            <div className="flex flex-col gap-1.5x">
              <div className="flex items-center justify-between gap-2x">
                <div className="min-w-0">
                  <p className="break-words text-body leading-snug text-ink-muted">
                    {journey.number} · {journey.name}
                  </p>
                  {peekStatus ? (
                    <p className="text-subhead">{peekStatus}</p>
                  ) : projected ? (
                    <p className="text-body font-semibold text-ink-muted">Projected position</p>
                  ) : (
                    <div className="flex items-baseline gap-1x">
                      <p className="text-headline tabular-nums">{journey.speedKmh}</p>
                      <p className="text-body text-ink-muted">km/h</p>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5x">
                  <StatusPill status={journey.status} delayMinutes={journey.delayMinutes} />
                  {countdown && (
                    <span className="text-caption font-medium tabular-nums text-ink-muted">{countdown}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1x">
                <TripStatBadge
                  label="Delay"
                  value={journey.delayMinutes > 0 ? `+${journey.delayMinutes}m` : 'On time'}
                />
                <TripStatBadge label="ETA" value={journey.ETA} />
              </div>

              <div className="flex items-center gap-1.5x text-caption text-ink-muted">
                <span className="min-w-0 flex-1 break-words">{journey.origin.code}</span>
                <span className="shrink-0 font-medium tabular-nums text-ink">
                  {Math.round(journey.completionPercentage)}%
                </span>
                <span className="min-w-0 flex-1 break-words text-right">{journey.destination.code}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-pill bg-ink-muted/15">
                <div
                  className="h-full rounded-pill bg-accent transition-[width] duration-700 ease-out"
                  style={{ width: `${journey.completionPercentage}%` }}
                />
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
