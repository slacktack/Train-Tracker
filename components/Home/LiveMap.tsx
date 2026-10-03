'use client';

import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, FilterSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { maplibregl } from '@/lib/maplibre';
import { LiveJourney, LiveTrain, StationGroup } from '@/types/train';
import { addRelief, getMapStyleUrl, tintBasemap } from '@/components/Map/mapStyle';
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
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <path d="M24 1 L31 12.5 Q31.6 13.6 30.4 13.2 L24 10.4 L17.6 13.2 Q16.4 13.6 17 12.5 Z" fill="#000000" stroke="#000000" stroke-width="1.4" stroke-linejoin="round"/>
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
  journey?: LiveJourney | null;
}

export function LiveMap({
  trains,
  stations,
  onSelect,
  onSelectStation,
  theme,
  selectedNumber = null,
  routeGeometry = null,
  journey = null,
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
  const journeyRef = useRef<LiveJourney | null>(null);
  journeyRef.current = journey;
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
    if (process.env.NODE_ENV !== 'production' || window.localStorage.getItem('tt-debug') === '1') (window as unknown as { __trainMap?: MapLibreMap }).__trainMap = map;

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

    // The selected train gets the same treatment as the tracker: covered route, remaining route, station dots.
    const pushRoute = () => {
      const j = journeyRef.current;
      const route = routeGeometryRef.current ?? [];
      const loc = j?.currentLocation;
      let covered: [number, number][] = [];
      let planned: [number, number][] = route;
      if (route.length > 1 && loc && (loc.lng || loc.lat)) {
        let best = 0;
        let bestD = Infinity;
        route.forEach(([x, y], i) => {
          const d = (x - loc.lng) ** 2 + (y - loc.lat) ** 2;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        covered = route.slice(0, best + 1);
        planned = route.slice(best);
      }
      const line = (coords: [number, number][]) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: coords.length > 1 ? coords : [] } });
      (map.getSource('sel-covered') as maplibregl.GeoJSONSource | null)?.setData(line(covered));
      (map.getSource('sel-planned') as maplibregl.GeoJSONSource | null)?.setData(line(planned));
      (map.getSource('sel-stations') as maplibregl.GeoJSONSource | null)?.setData({
        type: 'FeatureCollection',
        features: (j?.stations ?? [])
          .filter((st) => st.lat && st.lng)
          .map((st, i, all) => ({
            type: 'Feature' as const,
            properties: { code: st.code, passed: st.status === 'passed', end: i === 0 || i === all.length - 1 },
            geometry: { type: 'Point' as const, coordinates: [st.lng, st.lat] },
          })),
      });
    };

    map.once('style.load', async () => {
      tintBasemap(map, theme);
      addRelief(map, theme, apiKey);
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
        minzoom: 6.5,
        paint: {
          'circle-radius': 14,
          'circle-opacity': 0,
        },
      });

      map.addLayer({
        id: 'station-dot',
        type: 'circle',
        source: 'stations',
        minzoom: 6.5,
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
        minzoom: 6.5,
        paint: {
          'circle-radius': 9,
          'circle-color': '#8E8E93',
          'circle-opacity': 0.18,
          'circle-blur': 0.6,
        },
      });

      for (const id of ['sel-covered', 'sel-planned']) {
        map.addSource(id, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } } });
      }
      map.addSource('sel-stations', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      const dark = theme === 'dark';
      map.addLayer({ id: 'sel-planned-casing', type: 'line', source: 'sel-planned', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#0B1220', 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 4, 9, 6.5], 'line-opacity': 0.4 } });
      map.addLayer({ id: 'sel-planned', type: 'line', source: 'sel-planned', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 2, 9, 3.2], 'line-opacity': 0.95 } });
      map.addLayer({ id: 'sel-covered-glow', type: 'line', source: 'sel-covered', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': dark ? '#FFD21F' : '#6D28D9', 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 8, 9, 12], 'line-opacity': 0.25, 'line-blur': 2 } });
      map.addLayer({ id: 'sel-covered', type: 'line', source: 'sel-covered', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': dark ? '#FFD21F' : '#6D28D9', 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 3, 9, 5] } });
      map.addLayer({ id: 'sel-stations-dot', type: 'circle', source: 'sel-stations', paint: { 'circle-radius': ['case', ['get', 'end'], 6, 3.8], 'circle-color': ['case', ['get', 'passed'], '#141826', '#FFFFFF'], 'circle-stroke-width': 2, 'circle-stroke-color': ['case', ['get', 'passed'], '#FFFFFF', '#141826'] } });
      map.addLayer({ id: 'sel-stations-label', type: 'symbol', source: 'sel-stations', minzoom: 7, layout: { 'text-field': ['get', 'code'], 'text-size': 11, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-font': ['Noto Sans Bold'] }, paint: { 'text-color': dark ? '#FFFFFF' : '#141826', 'text-halo-color': dark ? '#0B1020' : '#FFFFFF', 'text-halo-width': 1.6 } });

      // Soft halo under moving trains.
      map.addLayer({
        id: 'train-halo',
        type: 'circle',
        source: 'trains',
        filter: ['==', ['get', 'src'], 'GPS'],
        paint: { 'circle-radius': 6.5, 'circle-color': ['get', 'color'], 'circle-opacity': 0.25, 'circle-blur': 0.6 },
      });
      if (theme === 'dark') {
        map.addLayer({
          id: 'train-neon',
          type: 'circle',
          source: 'trains',
          filter: ['==', ['get', 'src'], 'GPS'],
          paint: { 'circle-radius': 9, 'circle-color': ['get', 'color'], 'circle-opacity': 0.45, 'circle-blur': 0.9 },
        });
      }
      map.addLayer({
        id: 'train-casing',
        type: 'circle',
        source: 'trains',
        paint: { 'circle-radius': 3.6, 'circle-color': '#FFFFFF', 'circle-opacity': 0.95 },
      });
      map.addLayer({
        id: 'train-dot',
        type: 'circle',
        source: 'trains',
        paint: { 'circle-radius': 2.6, 'circle-color': ['get', 'color'] },
      });

      // A small pointer on the leading edge shows which way a moving train is heading.
      const noseSize = ['interpolate', ['linear'], ['zoom'], 3.5, 0.34, 5.5, 0.5, 8, 0.75, 11, 1];
      const noseLayout = (size: unknown) => ({
        'icon-image': 'train-dart',
        'icon-rotate': ['get', 'h'],
        'icon-size': size,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-pitch-alignment': 'map',
        'icon-rotation-alignment': 'map',
      });
      map.addLayer({
        id: 'train-arrow-outline',
        type: 'symbol',
        source: 'trains',
        filter: ['==', ['get', 'src'], 'GPS'],
        layout: noseLayout(['interpolate', ['linear'], ['zoom'], 3.5, 0.44, 5.5, 0.64, 8, 0.95, 11, 1.25]) as never,
        paint: { 'icon-color': '#FFFFFF', 'icon-opacity': 0.9 },
      });
      map.addLayer({
        id: 'train-arrow',
        type: 'symbol',
        source: 'trains',
        filter: ['==', ['get', 'src'], 'GPS'],
        layout: noseLayout(noseSize) as never,
        paint: { 'icon-color': ['get', 'color'], 'icon-opacity': 1 },
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
  }, [routeGeometry, journey]);

  // Selecting a train isolates it: every other train, and the station dots, step out of the way.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('train-selected-glow')) return;
    const pick: FilterSpecification = ['==', ['get', 'n'], selectedNumber ?? '__none__'];
    map.setFilter('train-selected-glow', pick);
    map.setFilter('train-selected-ring', pick);
    const gps: FilterSpecification = ['==', ['get', 'src'], 'GPS'];
    const only = (base: FilterSpecification): FilterSpecification => (selectedNumber ? (['all', base, pick] as unknown as FilterSpecification) : base);
    map.setFilter('train-arrow', only(gps));
    map.setFilter('train-arrow-outline', only(gps));
    map.setFilter('train-dot', selectedNumber ? pick : null);
    map.setFilter('train-casing', selectedNumber ? pick : null);
    map.setFilter('train-halo', only(gps));
    if (map.getLayer('train-neon')) map.setFilter('train-neon', only(gps));
    map.setFilter('train-hit', selectedNumber ? pick : null);
    for (const id of ['station-dot', 'station-ring', 'station-hit']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', selectedNumber ? 'none' : 'visible');
    }
  }, [selectedNumber]);

  // Frame the whole route when one is drawn, leaving room for the card on the left and panel on the right.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !routeGeometry || routeGeometry.length < 2) return;
    const lngs = routeGeometry.map((c) => c[0]);
    const lats = routeGeometry.map((c) => c[1]);
    const b: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];
    const wide = window.innerWidth >= 768;
    map.fitBounds(b, { padding: wide ? { top: 90, bottom: 60, left: 460, right: 400 } : { top: 80, bottom: 380, left: 30, right: 30 }, maxZoom: 9, duration: 900 });
  }, [routeGeometry]);

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
