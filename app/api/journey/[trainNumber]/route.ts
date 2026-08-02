import { NextRequest, NextResponse } from 'next/server';
import { getLiveJourney } from '@/lib/railjournal';
import { getRailRouteGeometry, snapPointToPolyline } from '@/lib/rail-route';
import { getCached, setCached } from '@/lib/redis-cache';
import { LiveJourney } from '@/types/train';

// Overpass rail-route geometry can take 10-40s on a cold route but the card
// data never uses it — serve the journey fast, warm the cache in background.
const ROUTE_GRACE_MS = 2_000;

export async function GET(
  _req: NextRequest,
  { params }: { params: { trainNumber: string } }
) {
  const { trainNumber } = params;
  const cacheKey = `journey:${trainNumber}`;

  const cached = await getCached<LiveJourney>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const journey = await getLiveJourney(trainNumber);
    if (!journey) {
      return NextResponse.json({ error: 'Train not found' }, { status: 404 });
    }

    // Static schedules (not_started/completed) barely change; live journeys
    // need ~feed-poll freshness.
    const ttl = journey.status === 'not_started' || journey.status === 'completed'
      ? 15 * 60
      : 20;

    // Pin the train marker onto the drawn track so the arrow never floats
    // beside the line (GPS noise / sparse station coords skew the raw fix).
    const snapToRoute = (coords: [number, number][]) => {
      const loc = journey.currentLocation;
      if (
        coords.length >= 2 &&
        Number.isFinite(loc.lat) &&
        Number.isFinite(loc.lng) &&
        (loc.lat !== 0 || loc.lng !== 0)
      ) {
        const snapped = snapPointToPolyline(loc.lat, loc.lng, coords);
        if (snapped && snapped.distanceKm <= 30) {
          journey.currentLocation = { ...loc, lat: snapped.lat, lng: snapped.lng };
        }
      }
    };

    await setCached(cacheKey, journey, ttl);

    const routePromise = getRailRouteGeometry(trainNumber, journey.stations)
      .then((railRoute) => {
        if (railRoute && railRoute.length >= 2) {
          journey.routeGeometry = railRoute;
          snapToRoute(railRoute);
        }
      })
      .catch(() => {
        // straight-line fallback still fine
      })
      .then(() => setCached(cacheKey, journey, ttl));

    await Promise.race([
      routePromise,
      new Promise((resolve) => setTimeout(resolve, ROUTE_GRACE_MS)),
    ]);

    return NextResponse.json(journey);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stale = await getCached<LiveJourney>(cacheKey);

    if (stale) {
      return NextResponse.json({ ...stale, stale: true });
    }
    console.warn(`[journey] railjournal fetch failed for ${trainNumber}:`, message);
    return NextResponse.json({ error: 'Failed to fetch journey' }, { status: 502 });
  }
}
