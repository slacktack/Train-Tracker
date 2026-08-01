'use client';

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LiveJourney } from '@/types/train';
import { getMapStyleUrl } from './mapStyle';
import { TrainMarker } from './TrainMarker';
import { createRoot } from 'react-dom/client';

interface MapCanvasProps {
  journey: LiveJourney;
}

function statusToRouteColor(delayMinutes: number): string {
  if (delayMinutes >= 15) return '#FF3B30';
  if (delayMinutes >= 1) return '#FF9F0A';
  return '#34C759';
}

export function MapCanvas({ journey }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setTheme(mq.matches ? 'dark' : 'light');
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY ?? '';

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyleUrl(theme, apiKey),
      center: [journey.currentLocation.lng, journey.currentLocation.lat],
      zoom: 7,
    });
    mapRef.current = map;

    map.on('load', () => {
      if (journey.routeGeometry && journey.routeGeometry.length > 1) {
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: journey.routeGeometry } },
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          paint: { 'line-color': statusToRouteColor(journey.delayMinutes), 'line-width': 4 },
        });
      }

      const el = document.createElement('div');
      createRoot(el).render(
        <TrainMarker heading={journey.currentLocation.heading} isMoving={journey.currentLocation.isMoving} />
      );
      markerRef.current = new maplibregl.Marker({ element: el }).setLngLat([
        journey.currentLocation.lng,
        journey.currentLocation.lat,
      ]).addTo(map);
    });

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  useEffect(() => {
    markerRef.current?.setLngLat([journey.currentLocation.lng, journey.currentLocation.lat]);
    mapRef.current?.easeTo({ center: [journey.currentLocation.lng, journey.currentLocation.lat], duration: 800 });
  }, [journey.currentLocation.lat, journey.currentLocation.lng]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
