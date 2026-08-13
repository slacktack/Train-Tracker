import { NextRequest, NextResponse } from 'next/server';
import { getLiveJourney, isValidJourneyDate } from '@/lib/railjournal';
import { getRailRouteGeometry, snapPointToPolyline } from '@/lib/rail-route';
import { getCached, setCached } from '@/lib/redis-cache';
import { LiveJourney } from '@/types/train';

// Overpass rail-route geometry can take 10-40s on a cold route but the card
// data never uses it — serve the journey fast, warm the cache in background.
// Blocking the response for it (even briefly) makes every cold journey load
// feel slow. useJourney refetches every 18s, so the background fill below
// reaches the client on the very next poll regardless — no need to wait here.
const ROUTE_GRACE_MS = 200;

/**
 * How long a journey response may be cached. Live journeys refresh at
 * feed-poll cadence; not_started journeys expire fast when departure is
 * imminent (so the status flips the moment the train rolls) and slowly when
 * departure is hours away; completed journeys are effectively static.
 */
function ttlForJourney(journey: LiveJourney): number {
  if (journey.status === 'not_started') {
    const dep = journey.stations[0]?.scheduledDeparture;
    if (!dep || dep === '--:--') return 10 * 60;
    const [h, m] = dep.split(':').map(Number);
    const now = new Date();
    const istNow = new Date(now.getTime() + 5.5 * 3600_000);
    const nowMin = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();
    const depMin = h * 60 + m;
    const minutesUntil = ((depMin - nowMin) % 1440 + 1440) % 1440;
    return minutesUntil <= 120 ? 30 : 10 * 60;
  }
  if (journey.status === 'completed') return 15 * 60;
  return 20;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { trainNumber: string } }
) {
  const { trainNumber } = params;
  // Optional explicit journey start date (DD-Mmm-YYYY) — pins the journey
  // to a specific run when auto start-date detection misses (see
  // resolveJourneyInfo in lib/railjournal.ts). Kept out of the default
  // cache key so an override never serves another date's cached journey.
  const dateParam = req.nextUrl.searchParams.get('date') ?? undefined;
  const override = isValidJourneyDate(dateParam) ? dateParam : undefined;
  const cacheKey = `journey:${trainNumber}:${override ?? 'auto'}`;

  const cached = await getCached<LiveJourney>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const journey = await getLiveJourney(trainNumber, override);
    if (!journey) {
      return NextResponse.json({ error: 'Train not found' }, { status: 404 });
    }

    const ttl = ttlForJourney(journey);

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
