import type { Map as MapLibreMap } from 'maplibre-gl';

// Muted data-viz basemap: quiet land and water so the trains are the loudest thing on screen.
export function getMapStyleUrl(theme: 'light' | 'dark', apiKey: string): string {
  const styleId = theme === 'dark' ? 'dataviz-dark' : 'dataviz-light';
  return `https://api.maptiler.com/maps/${styleId}/style.json?key=${apiKey}`;
}

type Paint = Array<[layer: string, prop: string, value: unknown]>;

const LIGHT: Paint = [
  ['Background', 'background-color', '#EFEBE0'],
  ['Landcover', 'fill-color', '#E9E6D6'],
  ['Forest', 'fill-color', '#C9D8B4'],
  ['Forest', 'fill-opacity', 0.55],
  ['Residential', 'fill-color', '#E4DFD0'],
  ['Water', 'fill-color', '#C5D9E2'],
  ['Water shadow', 'fill-color', '#B3CBD7'],
  ['River', 'line-color', '#B3CBD7'],
  ['Road network', 'line-color', '#FBF9F3'],
  ['Road network outline', 'line-color', '#DAD3C2'],
  ['Railway line', 'line-color', '#7C7667'],
  ['Railway line', 'line-width', ['interpolate', ['linear'], ['zoom'], 4, 0.7, 8, 1.2, 12, 2]],
  ['Railway dash', 'line-color', '#EFEBE0'],
  ['Country border', 'line-color', '#A59E8C'],
  ['Other border', 'line-color', '#B9B2A0'],
];

const DARK: Paint = [
  ['Background', 'background-color', '#0E1320'],
  ['Water', 'fill-color', '#0A0F1B'],
  ['Forest', 'fill-color', '#16241E'],
  ['Railway line', 'line-color', '#4A5268'],
  ['Railway line', 'line-width', ['interpolate', ['linear'], ['zoom'], 4, 0.7, 8, 1.2, 12, 2]],
];

// Recolour the base style in place and make the railway network readable from national zoom.
export function addRelief(map: MapLibreMap, theme: 'light' | 'dark', apiKey: string): void {
  try {
    if (!map.getSource('relief-dem')) {
      map.addSource('relief-dem', { type: 'raster-dem', url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${apiKey}`, tileSize: 256 });
    }
    if (!map.getLayer('relief')) {
      const before = map.getLayer('Water') ? 'Water' : undefined;
      map.addLayer(
        {
          id: 'relief',
          type: 'hillshade',
          source: 'relief-dem',
          paint: {
            'hillshade-exaggeration': theme === 'dark' ? 0.35 : 0.45,
            'hillshade-shadow-color': theme === 'dark' ? '#000000' : '#6B5E45',
            'hillshade-highlight-color': theme === 'dark' ? '#2A3550' : '#FFFFFF',
            'hillshade-accent-color': theme === 'dark' ? '#10151F' : '#8A7A5C',
          },
        },
        before,
      );
    }
  } catch {
    // relief is decoration: the map works without it
  }
}

export function tintBasemap(map: MapLibreMap, theme: 'light' | 'dark'): void {
  for (const [layer, prop, value] of theme === 'dark' ? DARK : LIGHT) {
    try {
      if (map.getLayer(layer)) map.setPaintProperty(layer, prop as never, value as never);
    } catch {
      // layer type differs between basemap versions: skip
    }
  }
  for (const id of ['Railway line', 'Railway dash']) {
    try {
      if (map.getLayer(id)) {
        map.setLayerZoomRange(id, 3.5, 24);
        map.setFilter(id, ['==', ['get', 'class'], 'rail']);
      }
    } catch {
      // keep the default railway filter
    }
  }
}
