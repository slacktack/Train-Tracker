'use client';

import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { maplibregl } from '@/lib/maplibre';
import { LiveJourney, Station } from '@/types/train';
import { addRelief, getMapStyleUrl, tintBasemap } from './mapStyle';
import { TrainMarker } from './TrainMarker';
import { createRoot, Root } from 'react-dom/client';
import { TimeTheme } from '@/lib/useTimeTheme';
import { WeatherSnapshot } from '@/types/geo';

// useJourney refetches every 18s; gliding the marker over (roughly) that
// window makes it look continuously in motion instead of frozen-then-jumping.
// Capped below the poll interval so a late-arriving update never leaves the
// marker mid-tween when the next one lands.
const MARKER_TWEEN_MS = 15_000;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

interface MapCanvasProps {
  journey: LiveJourney;
  theme: TimeTheme;
  weather?: WeatherSnapshot | null;
}

// Matches tailwind.config.ts `status` + `accent` tokens — kept as literal hex
// because MapLibre paint properties render to canvas, not the DOM, so they
// can't read CSS custom properties.
const STATUS_ON_TIME = '#22C55E';
const STATUS_MINOR_DELAY = '#F59E0B';
const STATUS_HEAVY_DELAY = '#EF4444';
const ACCENT = '#4F46E5';

function statusToRouteColor(delayMinutes: number): string {
  if (delayMinutes >= 15) return STATUS_HEAVY_DELAY;
  if (delayMinutes >= 1) return STATUS_MINOR_DELAY;
  return STATUS_ON_TIME;
}

function splitPolylineAtPoint(
  coords: [number, number][],
  lng: number,
  lat: number
): { covered: [number, number][]; planned: [number, number][] } {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const dx = coords[i][0] - lng;
    const dy = coords[i][1] - lat;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return { covered: coords.slice(0, bestIdx + 1), planned: coords.slice(bestIdx) };
}

/**
 * Snapped/simplified geometry can carry consecutive duplicate points; a
 * zero-length segment crashes MapLibre's dash renderer ("null 'y'" in
 * setConstantDashPositions), so strip them before the polyline reaches the map.
 */
function dedupePolyline(coords: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const c of coords) {
    const prev = out[out.length - 1];
    if (!prev || prev[0] !== c[0] || prev[1] !== c[1]) out.push(c);
  }
  return out;
}

/** A LineString with fewer than 2 points has no drawable segment. */
function isDrawableLine(coords: [number, number][]): boolean {
  return coords.length >= 2 && coords.every(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
}

export function MapCanvas({ journey, theme, weather }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const markerRootRef = useRef<Root | null>(null);
  const weatherMarkerRef = useRef<Marker | null>(null);
  const journeyRef = useRef(journey);
  journeyRef.current = journey;
  const weatherRef = useRef(weather);
  weatherRef.current = weather;
  const displayedPosRef = useRef<[number, number] | null>(null);
  const tweenFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY ?? '';

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyleUrl(theme, apiKey),
      center: [journeyRef.current.currentLocation.lng, journeyRef.current.currentLocation.lat],
      zoom: 7,
    });
    mapRef.current = map;

    const j = journeyRef.current;

    map.once('style.load', () => {
      tintBasemap(map, theme);
      addRelief(map, theme, apiKey);
      const routeColor = statusToRouteColor(j.delayMinutes);
      const loc = j.currentLocation;

      if (j.routeGeometry && j.routeGeometry.length > 1) {
        const route = dedupePolyline(j.routeGeometry);
        const { covered, planned } = splitPolylineAtPoint(route, loc.lng, loc.lat);

        if (isDrawableLine(covered) && isDrawableLine(planned)) {
          map.addSource('route-covered', {
            type: 'geojson',
            lineMetrics: true,
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: covered },
            },
          });
          // Gradient from the journey's start color to its live status color,
          // sweeping along ['line-progress'] — the glowing origin-to-now
          // traveled path instead of a flat single-color line.
          const coveredGradient: maplibregl.ExpressionSpecification = [
            'interpolate',
            ['linear'],
            ['line-progress'],
            0,
            ACCENT,
            1,
            routeColor,
          ];
          map.addLayer({
            id: 'route-covered-glow',
            type: 'line',
            source: 'route-covered',
            paint: { 'line-gradient': coveredGradient, 'line-width': 8, 'line-opacity': 0.3 },
          });
          map.addLayer({
            id: 'route-covered',
            type: 'line',
            source: 'route-covered',
            paint: { 'line-gradient': coveredGradient, 'line-width': 4 },
          });

          map.addSource('route-planned', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: planned },
            },
          });
          // A solid casing + core line reads as an actual track ahead, not a
          // dashed "estimated" guess — the dashed marching-ants version was
          // being misread as an approximation rather than the real route.
          map.addLayer({
            id: 'route-planned-casing',
            type: 'line',
            source: 'route-planned',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#0B1220', 'line-width': 5, 'line-opacity': 0.35 },
          });
          map.addLayer({
            id: 'route-planned',
            type: 'line',
            source: 'route-planned',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#FFFFFF',
              'line-width': 2.5,
              'line-opacity': 0.85,
            },
          });
        }
      }

      const stationFeatures = j.stations
        .filter((s) => s.lat && s.lng)
        .map((s, i) => ({
          type: 'Feature' as const,
          properties: {
            stColor: stationDotColor(s, i, j),
            stCode: s.code,
            isOrigin: i === 0,
            isDest: i === j.stations.length - 1,
          },
          geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
        }));

      if (stationFeatures.length > 0) {
        map.addSource('station-dots', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: stationFeatures },
        });
        map.addLayer({
          id: 'station-dot',
          type: 'circle',
          source: 'station-dots',
          paint: {
            'circle-radius': [
              'case',
              ['get', 'isOrigin'], 6,
              ['get', 'isDest'], 6,
              4,
            ],
            'circle-color': ['get', 'stColor'],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FFFFFF',
          },
        });
        map.addLayer({
          id: 'station-halo',
          type: 'circle',
          source: 'station-dots',
          filter: ['==', ['get', 'isOrigin'], true],
          paint: {
            'circle-radius': 13,
            'circle-color': ['get', 'stColor'],
            'circle-opacity': 0.22,
            'circle-blur': 0.6,
          },
        });
      }

      const el = document.createElement('div');
      const root = createRoot(el);
      root.render(
        <TrainMarker
          heading={j.currentLocation.heading}
          isMoving={j.currentLocation.isMoving}
          ghost={j.currentLocation.positionSource === 'projected'}
        />
      );
      markerRootRef.current = root;
      displayedPosRef.current = [j.currentLocation.lng, j.currentLocation.lat];
      markerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([j.currentLocation.lng, j.currentLocation.lat])
        .addTo(map);

      if (weatherRef.current) {
        mountWeatherChip(map, weatherRef.current, loc.lng, loc.lat);
      }
    });

    return () => {
      if (tweenFrameRef.current !== null) cancelAnimationFrame(tweenFrameRef.current);
      markerRef.current?.remove();
      weatherMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      markerRootRef.current = null;
      weatherMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  function mountWeatherChip(map: MapLibreMap, w: WeatherSnapshot, lng: number, lat: number) {
    const chip = document.createElement('div');
    chip.className =
      'pointer-events-none flex items-center gap-1 rounded-pill border border-white/40 bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-md';
    chip.textContent = `${w.condition} ${w.tempC}°C`;
    weatherMarkerRef.current = new maplibregl.Marker({ element: chip, anchor: 'bottom' })
      .setLngLat([lng, lat])
      .addTo(map);
  }

  useEffect(() => {
    const target: [number, number] = [journey.currentLocation.lng, journey.currentLocation.lat];

    // The marker's React root is only mounted once; re-render it here so
    // heading/motion/ghost state actually updates as new journey data lands
    // instead of staying frozen at whatever it was on first paint.
    markerRootRef.current?.render(
      <TrainMarker
        heading={journey.currentLocation.heading}
        isMoving={journey.currentLocation.isMoving}
        ghost={journey.currentLocation.positionSource === 'projected'}
      />
    );

    if (tweenFrameRef.current !== null) {
      cancelAnimationFrame(tweenFrameRef.current);
      tweenFrameRef.current = null;
    }
    const start = displayedPosRef.current ?? target;
    const startTime = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / MARKER_TWEEN_MS);
      const pos: [number, number] = [lerp(start[0], target[0], t), lerp(start[1], target[1], t)];
      displayedPosRef.current = pos;
      markerRef.current?.setLngLat(pos);
      tweenFrameRef.current = t < 1 ? requestAnimationFrame(tick) : null;
    };
    tweenFrameRef.current = requestAnimationFrame(tick);

    mapRef.current?.easeTo({ center: target, duration: 800 });

    const map = mapRef.current;
    if (map?.loaded() && journey.routeGeometry && journey.routeGeometry.length > 1) {
      const loc = journey.currentLocation;
      const route = dedupePolyline(journey.routeGeometry);
      const { covered, planned } = splitPolylineAtPoint(route, loc.lng, loc.lat);
      if (isDrawableLine(covered) && isDrawableLine(planned)) {
        (map.getSource('route-covered') as maplibregl.GeoJSONSource | undefined)?.setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: covered },
        });
        (map.getSource('route-planned') as maplibregl.GeoJSONSource | undefined)?.setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: planned },
        });
      }
    }

    const source = map?.getSource('station-dots') as maplibregl.GeoJSONSource | undefined;
    if (map?.loaded() && source) {
      const features = journey.stations
        .filter((s) => s.lat && s.lng)
        .map((s, i) => ({
          type: 'Feature' as const,
          properties: {
            stColor: stationDotColor(s, i, journey),
            stCode: s.code,
            isOrigin: i === 0,
            isDest: i === journey.stations.length - 1,
          },
          geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
        }));
      source.setData({ type: 'FeatureCollection', features });
    }

    if (weather && map) {
      weatherMarkerRef.current?.remove();
      weatherMarkerRef.current = null;
      if (map.loaded()) {
        mountWeatherChip(map, weather, journey.currentLocation.lng, journey.currentLocation.lat);
      }
    }
  }, [journey, weather]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

function stationDotColor(station: Station, index: number, journey: LiveJourney): string {
  const isOrigin = index === 0;
  const isDest = index === journey.stations.length - 1;
  if (journey.status === 'not_started' && isOrigin) return ACCENT;
  if (journey.status === 'completed' && isDest) return STATUS_ON_TIME;
  if (isOrigin) return STATUS_ON_TIME;
  if (isDest) return STATUS_MINOR_DELAY;
  if (station.status === 'passed') return 'rgba(152, 152, 160, 0.45)';
  if (station.status === 'current') return ACCENT;
  return 'rgba(174, 174, 178, 0.7)';
}
