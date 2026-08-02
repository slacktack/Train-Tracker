'use client';

import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, FilterSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { maplibregl } from '@/lib/maplibre';
import { LiveTrain, StationGroup } from '@/types/train';
import { getMapStyleUrl } from '@/components/Map/mapStyle';
import { TimeTheme } from '@/lib/useTimeTheme';
import { trainTypeColor } from '@/lib/train-type';

const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [65, 5],
  [100, 38],
];

// A rail-nose dart pointing north (up). Registered as an SDF image so
// icon-color tints it per train type; icon-rotate swings it to the heading.
// Explicit width/height are REQUIRED: without them the SVG's natural size is
// 300x150 and maplibre icon-size multiplies against that (~96px darts!).
const TRAIN_DART_SVG =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <path d="M12 1.5 L17.2 22 L12 17.8 L6.8 22 Z" fill="#000000"/>
  <rect x="10" y="15.5" width="4" height="5" rx="1.5" fill="#000000"/>
</svg>`
  );

function loadSdfImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

interface LiveMapProps {
  trains: LiveTrain[];
  stations: StationGroup[];
  onSelect: (train: LiveTrain) => void;
  onSelectStation: (station: StationGroup) => void;
  theme: TimeTheme;
  selectedNumber?: string | null;
  routeGeometry?: [number, number][] | null;
}

export function LiveMap({
  trains,
  stations,
  onSelect,
  onSelectStation,
  theme,
  selectedNumber = null,
  routeGeometry = null,
}: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onSelectStationRef = useRef(onSelectStation);
  onSelectStationRef.current = onSelectStation;
  const trainsRef = useRef<LiveTrain[]>([]);
  trainsRef.current = trains;
  const stationsRef = useRef<StationGroup[]>([]);
  stationsRef.current = stations;
  const selectedNumberRef = useRef<string | null>(selectedNumber);
  selectedNumberRef.current = selectedNumber;
  const routeGeometryRef = useRef<[number, number][] | null>(null);
  routeGeometryRef.current = routeGeometry;
  const pushTrainsRef = useRef<() => void>(() => {});
  const pushStationsRef = useRef<() => void>(() => {});
  const pushRouteRef = useRef<() => void>(() => {});
  const savedViewRef = useRef<{ center: [number, number]; zoom: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY ?? '';

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyleUrl(theme, apiKey),
      center: savedViewRef.current?.center ?? [78.96, 22.35],
      zoom: savedViewRef.current?.zoom ?? 4.5,
      minZoom: 3.5,
      maxZoom: 12,
      maxBounds: INDIA_BOUNDS,
    });
    mapRef.current = map;

    const pushTrains = () => {
      const source = map.getSource('trains') as maplibregl.GeoJSONSource | null;
      if (!source) return;
      source.setData({
        type: 'FeatureCollection',
        features: trainsRef.current.map((t) => ({
          type: 'Feature' as const,
          properties: { ...t, color: trainTypeColor(t.type) },
          geometry: { type: 'Point' as const, coordinates: [t.lon, t.lat] },
        })),
      });
    };

    const pushStations = () => {
      const source = map.getSource('stations') as maplibregl.GeoJSONSource | null;
      if (!source) return;
      source.setData({
        type: 'FeatureCollection',
        features: stationsRef.current.map((s) => ({
          type: 'Feature' as const,
          properties: { code: s.code, name: s.name, count: s.count },
          geometry: { type: 'Point' as const, coordinates: [s.lon, s.lat] },
        })),
      });
    };

    const pushRoute = () => {
      const source = map.getSource('selected-route') as maplibregl.GeoJSONSource | null;
      if (!source) return;
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: routeGeometryRef.current ?? [] },
      });
    };

    map.on('load', async () => {
      try {
        const dart = await loadSdfImage(TRAIN_DART_SVG);
        if (!map.getImage('train-dart')) {
          map.addImage('train-dart', dart, { sdf: true });
        }
      } catch {
        // icon fallback: colored dot still renders
      }

      map.addSource('trains', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource('stations', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Station dots sit UNDER the train layers: taps on a train win, taps on
      // the dot (or its fat hit layer) open the departure board.
      map.addLayer({
        id: 'station-hit',
        type: 'circle',
        source: 'stations',
        paint: {
          'circle-radius': 14,
          'circle-opacity': 0,
        },
      });

      map.addLayer({
        id: 'station-dot',
        type: 'circle',
        source: 'stations',
        paint: {
          'circle-radius': 5,
          'circle-color': '#FFFFFF',
          'circle-opacity': 0.85,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#8E8E93',
        },
      });

      map.addLayer({
        id: 'station-ring',
        type: 'circle',
        source: 'stations',
        paint: {
          'circle-radius': 9,
          'circle-color': '#8E8E93',
          'circle-opacity': 0.18,
          'circle-blur': 0.6,
        },
      });

      map.addSource('selected-route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
      });

      map.addLayer({
        id: 'selected-route-line',
        type: 'line',
        source: 'selected-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          // Matches --accent in app/globals.css; MapLibre paint values are canvas
          // colors, not CSS, so the custom property can't be read directly here.
          'line-color': theme === 'dark' ? '#818CFF' : '#4F46E5',
          'line-width': 3,
          'line-opacity': 0.85,
        },
      });

      map.addLayer({
        id: 'train-halo',
        type: 'circle',
        source: 'trains',
        filter: ['==', ['get', 'src'], 'GPS'],
        paint: {
          'circle-radius': 6,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.25,
          'circle-blur': 0.6,
        },
      });

      // Neon under-glow in dark mode: same SDF dart, but the halo reads as a
      // glowing lamp against the dark basemap instead of a soft smudge.
      if (theme === 'dark') {
        map.addLayer({
          id: 'train-neon',
          type: 'circle',
          source: 'trains',
          filter: ['==', ['get', 'src'], 'GPS'],
          paint: {
            'circle-radius': 9,
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.5,
            'circle-blur': 0.9,
          },
        });
      }

      map.addLayer({
        id: 'train-casing',
        type: 'circle',
        source: 'trains',
        paint: {
          'circle-radius': 3.5,
          'circle-color': '#FFFFFF',
          'circle-opacity': 0.9,
        },
      });

      map.addLayer({
        id: 'train-dot',
        type: 'circle',
        source: 'trains',
        paint: {
          'circle-radius': 2.5,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#FFFFFF',
        },
      });

      map.addLayer({
        id: 'train-arrow',
        type: 'symbol',
        source: 'trains',
        filter: ['==', ['get', 'src'], 'GPS'],
        layout: {
          'icon-image': 'train-dart',
          'icon-rotate': ['get', 'h'],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 3.5, 0.18, 5.5, 0.26, 8, 0.38],
          'icon-allow-overlap': true,
          'icon-pitch-alignment': 'map',
          'icon-rotation-alignment': 'map',
        },
        paint: {
          'icon-color': ['get', 'color'],
          'icon-halo-color': '#FFFFFF',
          'icon-halo-width': 1,
          'icon-opacity': 0.95,
        },
      });

      // Invisible fat layer: makes the tiny dots easy to hover/click.
      map.addLayer({
        id: 'train-hit',
        type: 'circle',
        source: 'trains',
        paint: {
          'circle-radius': 14,
          'circle-opacity': 0,
        },
      });

      // Selected-train glow tracks the tapped train above all other layers.
      map.addLayer({
        id: 'train-selected-glow',
        type: 'circle',
        source: 'trains',
        filter: ['==', ['get', 'n'], selectedNumberRef.current ?? '__none__'],
        paint: {
          'circle-radius': 16,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.35,
          'circle-blur': 0.7,
        },
      });
      map.addLayer({
        id: 'train-selected-ring',
        type: 'circle',
        source: 'trains',
        filter: ['==', ['get', 'n'], selectedNumberRef.current ?? '__none__'],
        paint: {
          'circle-radius': 9,
          'circle-color': 'transparent',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#FFFFFF',
        },
      });

      // Nearest-feature picking: with 2000+ overlapping trains, the first
      // rendered feature is rarely the one the user aimed at. Compare screen
      // distances and take the closest hit to the tap point.
      function nearestFeature(e: maplibregl.MapMouseEvent, layerIds: string[]) {
        let best: maplibregl.GeoJSONFeature | null = null;
        let bestDist = Infinity;
        for (const id of layerIds) {
          for (const f of map.queryRenderedFeatures(e.point, { layers: [id] })) {
            const coords = f.geometry?.type === 'Point' ? (f.geometry.coordinates as [number, number]) : null;
            if (!coords) continue;
            const px = map.project([coords[0], coords[1]]);
            const d = Math.hypot(px.x - e.point.x, px.y - e.point.y);
            if (d < bestDist) {
              bestDist = d;
              best = f;
            }
          }
        }
        return best;
      }

      map.on('click', (e) => {
        const props = nearestFeature(e, ['train-hit'])?.properties;
        if (props?.n) {
          onSelectRef.current({
            n: props.n,
            name: props.name,
            type: props.type,
            lat: props.lat,
            lon: props.lon,
            src: props.src,
            h: props.h,
            stn: props.stn,
            stc: props.stc,
            st: props.st,
          });
          return;
        }
        const sProps = nearestFeature(e, ['station-hit'])?.properties;
        if (sProps?.code) {
          onSelectStationRef.current({
            code: sProps.code,
            name: sProps.name,
            lat: sProps.lat,
            lon: sProps.lon,
            count: sProps.count,
            trains: stationsRef.current.find((s) => s.code === sProps.code)?.trains ?? [],
          });
        }
      });

      map.on('mousemove', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['train-hit', 'station-hit'] });
        map.getCanvas().style.cursor = features.length > 0 ? 'pointer' : '';
      });

      pushTrains();
      pushStations();
      pushRoute();
    });

    pushTrainsRef.current = pushTrains;
    pushStationsRef.current = pushStations;
    pushRouteRef.current = pushRoute;

    return () => {
      savedViewRef.current = {
        center: [map.getCenter().lng, map.getCenter().lat],
        zoom: map.getZoom(),
      };
      map.remove();
      mapRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    pushTrainsRef.current();
  }, [trains]);

  useEffect(() => {
    pushStationsRef.current();
  }, [stations]);

  useEffect(() => {
    pushRouteRef.current();
  }, [routeGeometry]);

  // Keep the selected glow + ring tracking whichever train is open.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('train-selected-glow')) return;
    const filter: FilterSpecification = ['==', ['get', 'n'], selectedNumber ?? '__none__'];
    map.setFilter('train-selected-glow', filter);
    map.setFilter('train-selected-ring', filter);
  }, [selectedNumber]);

  return (
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        role="application"
        aria-label="Live map of active trains in India"
        className="h-full w-full"
      />
    </div>
  );
}
