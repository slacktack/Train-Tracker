import { ElevationPoint } from '@/types/geo';

interface ElevationChartProps {
  points: ElevationPoint[];
  width?: number;
  height?: number;
}

export function buildElevationPath(points: ElevationPoint[], width: number, height: number): string {
  if (points.length === 0) return '';
  const elevations = points.map((p) => p.elevationM);
  const minEl = Math.min(...elevations);
  const maxEl = Math.max(...elevations);
  const range = maxEl - minEl || 1;
  const maxDist = points[points.length - 1].distanceKm || 1;

  return points
    .map((p, i) => {
      const x = (p.distanceKm / maxDist) * width;
      const y = height - ((p.elevationM - minEl) / range) * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function ElevationChart({ points, width = 320, height = 80 }: ElevationChartProps) {
  if (points.length === 0) {
    return null;
  }
  const path = buildElevationPath(points, width, height);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="text-accent">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
