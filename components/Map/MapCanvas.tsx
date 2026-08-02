'use client';

import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { maplibregl } from '@/lib/maplibre';
import { LiveJourney, Station } from '@/types/train';
import { getMapStyleUrl } from './mapStyle';
import { TrainMarker } from './TrainMarker';
import { createRoot } from 'react-dom/client';
import { TimeTheme } from '@/lib/useTimeTheme';
import { WeatherSnapshot } from '@/types/geo';

interface MapCanvasProps {
  journey: LiveJourney;
  theme: TimeTheme;
  weather?: WeatherSnapshot | null;
}

function statusToRouteColor(delayMinutes: number): string {
  if (delayMinutes >= 15) return '#FF3B30';
  if (delayMinutes >= 1) return '#FF9F0A';
  return '#34C759';
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

export function MapCanvas({ journey, theme, weather }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const weatherMarkerRef = useRef<Marker | null>(null);
  const dashAnimRef = useRef<number | null>(null);
  const journeyRef = useRef(journey);
  journeyRef.current = journey;
  const weatherRef = useRef(weather);
  weatherRef.current = weather;

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

    map.on('load', () => {
      const routeColor = statusToRouteColor(j.delayMinutes);
      const loc = j.currentLocation;

      if (j.routeGeometry && j.routeGeometry.length > 1) {
        const { covered, planned } = splitPolylineAtPoint(j.routeGeometry, loc.lng, loc.lat);

        map.addSource('route-covered', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: covered },
          },
        });
        map.addLayer({
          id: 'route-covered-glow',
          type: 'line',
          source: 'route-covered',
          paint: { 'line-color': routeColor, 'line-width': 8, 'line-opacity': 0.25 },
        });
        map.addLayer({
          id: 'route-covered',
          type: 'line',
          source: 'route-covered',
          paint: { 'line-color': routeColor, 'line-width': 4 },
        });

        map.addSource('route-planned', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: planned },
          },
        });
        map.addLayer({
          id: 'route-planned',
          type: 'line',
          source: 'route-planned',
          paint: {
            'line-color': '#FFFFFF',
            'line-width': 3,
            'line-dasharray': [0.35, 1.85],
            'line-opacity': 0.7,
          },
        });

        const DASH_PERIOD = 2.2;
        const animateDashes = () => {
          const m = mapRef.current;
          if (!m || !m.getLayer('route-planned')) return;
          const phase = (Date.now() / 1000) % DASH_PERIOD;
          const fill = 0.35 + 1.5 * (phase / DASH_PERIOD);
          m.setPaintProperty('route-planned', 'line-dasharray', [fill, DASH_PERIOD - fill]);
          dashAnimRef.current = requestAnimationFrame(animateDashes);
        };
        animateDashes();
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
      createRoot(el).render(
        <TrainMarker
          heading={j.currentLocation.heading}
          isMoving={j.currentLocation.isMoving}
          ghost={j.currentLocation.positionSource === 'projected'}
        />
      );
      markerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([j.currentLocation.lng, j.currentLocation.lat])
        .addTo(map);

      if (weatherRef.current) {
        mountWeatherChip(map, weatherRef.current, loc.lng, loc.lat);
      }
    });

    return () => {
      if (dashAnimRef.current !== null) cancelAnimationFrame(dashAnimRef.current);
      markerRef.current?.remove();
      weatherMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
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
    markerRef.current?.setLngLat([journey.currentLocation.lng, journey.currentLocation.lat]);
    mapRef.current?.easeTo({ center: [journey.currentLocation.lng, journey.currentLocation.lat], duration: 800 });

    const map = mapRef.current;
    if (map?.loaded() && journey.routeGeometry && journey.routeGeometry.length > 1) {
      const loc = journey.currentLocation;
      const { covered, planned } = splitPolylineAtPoint(journey.routeGeometry, loc.lng, loc.lat);
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
  if (journey.status === 'not_started' && isOrigin) return '#0A84FF';
  if (journey.status === 'completed' && isDest) return '#34C759';
  if (isOrigin) return '#34C759';
  if (isDest) return '#FF9F0A';
  if (station.status === 'passed') return 'rgba(152, 152, 160, 0.45)';
  if (station.status === 'current') return '#0A84FF';
  return 'rgba(174, 174, 178, 0.7)';
}
