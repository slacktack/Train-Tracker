'use client';

import { useJourney } from '@/hooks/useJourney';
import { useRouteContext } from '@/hooks/useRouteContext';
import { useWeather } from '@/hooks/useWeather';
import { MapCanvas } from '@/components/Map/MapCanvas';
import { BottomSheet } from '@/components/BottomSheet/BottomSheet';
import { TripStatBadge } from '@/components/TripStatBadge';
import { ElevationChart } from '@/components/ElevationChart';
import { ContextCard } from '@/components/ContextCard';
import { StationRow } from '@/components/StationRow';
import { StatusPill } from '@/components/ui/StatusPill';
import { getSunInfo } from '@/lib/sun';

export function TrackingScreen({ trainNumber }: { trainNumber: string }) {
  const { data: journey, isLoading, error } = useJourney(trainNumber);

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

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center">Loading train...</div>;
  }

  if (error || !journey) {
    return <div className="flex min-h-screen items-center justify-center">Couldn&apos;t load this train. Try again shortly.</div>;
  }

  const sun = getSunInfo(journey.currentLocation.lat, journey.currentLocation.lng);

  return (
    <div className="relative min-h-screen">
      <MapCanvas journey={journey} />

      <BottomSheet
        peek={
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink-muted">{journey.number} · {journey.name}</p>
              <p className="text-2xl font-semibold tabular-nums">{journey.speedKmh} km/h</p>
            </div>
            <StatusPill status={journey.status} delayMinutes={journey.delayMinutes} />
          </div>
        }
        half={
          <div className="mt-3x flex flex-col gap-3x">
            {routeContext.data && routeContext.data.elevationProfile.length > 0 && (
              <ElevationChart points={routeContext.data.elevationProfile} />
            )}
            <div className="grid grid-cols-3 gap-1x">
              <TripStatBadge label="Complete" value={`${Math.round(journey.completionPercentage)}%`} />
              <TripStatBadge label="Remaining" value={`${Math.round(journey.remainingDistanceKm)} km`} />
              <TripStatBadge label="ETA" value={journey.ETA} />
            </div>
            <div>
              {journey.nextStation && <StationRow station={journey.nextStation} />}
            </div>
          </div>
        }
        full={
          <div className="mt-3x flex flex-col gap-3x">
            <div className="flex flex-wrap gap-1x">
              {weather.data && <ContextCard variant="weather" weather={weather.data} />}
              <ContextCard variant="sun" sun={sun} />
              {routeContext.data?.terrainFeatures.slice(0, 4).map((f) => (
                <ContextCard key={`${f.type}-${f.name}`} variant="terrain" feature={f} />
              ))}
            </div>
            <div>
              {journey.stations.map((s) => (
                <StationRow key={s.code} station={s} />
              ))}
            </div>
          </div>
        }
      />
    </div>
  );
}
