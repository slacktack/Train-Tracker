export interface Station {
  code: string;
  name: string;
  lat: number;
  lng: number;
  scheduledArrival: string;
  scheduledDeparture: string;
  actualArrival?: string;
  actualDeparture?: string;
  delayMinutes: number;
  distanceKm: number;
  status: 'passed' | 'current' | 'upcoming';
  platform?: string;
  haltMinutes?: number;
}

export interface SearchResult {
  id: string;
  number: string;
  name: string;
  origin: { code: string; name: string };
  destination: { code: string; name: string };
  runsOn?: string[];
  duration?: string;
  departureTime?: string;
  arrivalTime?: string;
  /** Short human-readable running status, e.g. "Running · 82 km/h", "At station", "Not running today" — disambiguates same-named trains before you tap in. */
  liveNote?: string;
}

export interface LiveLocation {
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
  isMoving: boolean;
  /**
   * Where the position came from. `projected` means the train has no live
   * fix — the point is interpolated along the route from schedule timing.
   */
  positionSource?: 'gps' | 'station' | 'projected' | 'none';
}

export interface LiveJourney {
  trainId: string;
  number: string;
  name: string;
  nameUnicode?: string;
  type?: string;
  origin: { code: string; name: string };
  destination: { code: string; name: string };
  currentLocation: LiveLocation;
  status: 'running' | 'delayed' | 'on_time' | 'cancelled' | 'not_started' | 'completed';
  delayMinutes: number;
  speedKmh: number;
  distanceCoveredKm: number;
  remainingDistanceKm: number;
  totalDistanceKm: number;
  completionPercentage: number;
  lastUpdated: string;
  previousStation?: Station;
  currentStation?: Station;
  nextStation?: Station;
  ETA: string;
  stations: Station[];
  routeGeometry?: [number, number][];
  stale?: boolean;
}

/** Compact row from `/api/active-trains` (server-trimmed live feed). */
export interface LiveTrain {
  n: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  src: 'STATION' | 'GPS';
  h: number;
  stn?: string;
  stc?: string;
  st: string;
  /** Estimated ground speed (km/h) from consecutive GPS fixes. */
  spd?: number;
}

/** Active trains grouped by station — powers the tap-station departure board. */
export interface StationGroup {
  code: string;
  name: string;
  lat: number;
  lon: number;
  count: number;
  trains: LiveTrain[];
}
