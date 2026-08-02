import { NextRequest, NextResponse } from 'next/server';
import { getTerrainFeatures } from '@/lib/overpass';
import { getElevationProfile } from '@/lib/openelevation';
import { getCached, setCached } from '@/lib/redis-cache';
import { TerrainFeature, ElevationPoint } from '@/types/geo';

interface RouteContextResponse {
  terrainFeatures: TerrainFeature[];
  elevationProfile: ElevationPoint[];
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const routeGeometry: [number, number][] = body.routeGeometry ?? [];
  const totalDistanceKm: number = body.totalDistanceKm ?? 0;
  const trainNumber: string = body.trainNumber ?? 'unknown';

  const cacheKey = `route-context:${trainNumber}`;
  const cached = await getCached<RouteContextResponse>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  // Elevation is fast (~300ms) and powers the chart — never let the slow
  // Overpass terrain lookup block it. Terrain resolves in the background race
  // and arrives as soon as it's ready (or as an empty list after 6s).
  const elevationProfile = await getElevationProfile(routeGeometry, totalDistanceKm);
  const terrainFeatures = await Promise.race([
    getTerrainFeatures(routeGeometry),
    new Promise<TerrainFeature[]>((resolve) => setTimeout(() => resolve([]), 6_000)),
  ]).catch(() => [] as TerrainFeature[]);

  const response: RouteContextResponse = { terrainFeatures, elevationProfile };
  const isLikelyFailure = terrainFeatures.length === 0 && elevationProfile.length === 0;
  if (!isLikelyFailure) {
    await setCached(cacheKey, response, 86400);
  }
  return NextResponse.json(response);
}
