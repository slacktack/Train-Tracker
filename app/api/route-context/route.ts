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

  const [terrainFeatures, elevationProfile] = await Promise.all([
    getTerrainFeatures(routeGeometry),
    getElevationProfile(routeGeometry, totalDistanceKm),
  ]);

  const response: RouteContextResponse = { terrainFeatures, elevationProfile };
  await setCached(cacheKey, response, 86400);
  return NextResponse.json(response);
}
