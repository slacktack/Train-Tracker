'use client';

import { useQuery } from '@tanstack/react-query';
import { TerrainFeature, ElevationPoint } from '@/types/geo';

interface RouteContextResponse {
  terrainFeatures: TerrainFeature[];
  elevationProfile: ElevationPoint[];
}

async function fetchRouteContext(
  routeGeometry: [number, number][],
  totalDistanceKm: number,
  trainNumber: string
): Promise<RouteContextResponse> {
  const res = await fetch('/api/route-context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ routeGeometry, totalDistanceKm, trainNumber }),
  });
  if (!res.ok) throw new Error(`Failed to fetch route context: ${res.status}`);
  return res.json();
}

export function useRouteContext(
  routeGeometry: [number, number][] | undefined,
  totalDistanceKm: number,
  trainNumber: string,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['route-context', trainNumber],
    queryFn: () => fetchRouteContext(routeGeometry ?? [], totalDistanceKm, trainNumber),
    enabled: enabled && !!routeGeometry && routeGeometry.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
