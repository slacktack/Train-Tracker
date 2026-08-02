import { Mountain } from 'lucide-react';
import { ElevationPoint } from '@/types/geo';

interface ElevationChartProps {
  points: ElevationPoint[];
  /** Distance along the route in km where the train is now — draws the marker. */
  currentKm?: number;
}

const W = 320;
const H = 176;
const PAD = { t: 18, r: 10, b: 28, l: 44 };

function buildScale(points: ElevationPoint[], width: number, height: number) {
  const elevations = points.map((p) => p.elevationM);
  const minEl = Math.min(...elevations);
  const maxEl = Math.max(...elevations);
  const range = maxEl - minEl || 1;
  const maxDist = points[points.length - 1].distanceKm || 1;
  const iw = width - PAD.l - PAD.r;
  const ih = height - PAD.t - PAD.b;
  const x = (d: number) => PAD.l + (d / maxDist) * iw;
  const y = (el: number) => PAD.t + (1 - (el - minEl) / range) * ih;
  return { minEl, maxEl, range, maxDist, x, y };
}

export function buildElevationPath(points: ElevationPoint[], width: number, height: number): string {
  if (points.length === 0) return '';
  const { x, y } = buildScale(points, width, height);
  return toPath(points, x, y);
}

function toPath(points: ElevationPoint[], x: (d: number) => number, y: (el: number) => number): string {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.distanceKm).toFixed(1)},${y(p.elevationM).toFixed(1)}`)
    .join(' ');
}

/** Interpolated chart point at an arbitrary route km (for the passed/upcoming split). */
function pointAtKm(
  points: ElevationPoint[],
  km: number,
  x: (d: number) => number,
  y: (el: number) => number
): { cx: number; cy: number } | null {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (km >= a.distanceKm && km <= b.distanceKm) {
      const t = (km - a.distanceKm) / (b.distanceKm - a.distanceKm || 1);
      return { cx: x(km), cy: y(a.elevationM + (b.elevationM - a.elevationM) * t) };
    }
  }
  return null;
}

export function ElevationChart({ points, currentKm }: ElevationChartProps) {
  if (points.length === 0) return null;

  const { minEl, maxEl, maxDist, x, y } = buildScale(points, W, H);
  const linePath = buildElevationPath(points, W, H);
  const areaPath = `${linePath} L${x(maxDist).toFixed(1)},${H - PAD.b} L${x(0).toFixed(1)},${H - PAD.b} Z`;

  const inRange = currentKm != null && currentKm >= 0 && currentKm <= maxDist;
  const marker = inRange ? pointAtKm(points, currentKm as number, x, y) : null;

  // Split into travelled (accent) and remaining (muted) segments.
  const cutoff = inRange ? (currentKm as number) : maxDist;
  const passed = points.filter((p) => p.distanceKm <= cutoff);
  const upcoming = points.filter((p) => p.distanceKm >= cutoff);
  if (marker) {
    passed.push({ lat: 0, lng: 0, elevationM: minEl + ((marker.cy - PAD.t) / (H - PAD.t - PAD.b)) * (maxEl - minEl), distanceKm: cutoff });
    upcoming.unshift({ lat: 0, lng: 0, elevationM: minEl + ((marker.cy - PAD.t) / (H - PAD.t - PAD.b)) * (maxEl - minEl), distanceKm: cutoff });
  }
  const passedPath = passed.length >= 2 ? toPath(passed, x, y) : null;
  const upcomingPath = upcoming.length >= 2 ? toPath(upcoming, x, y) : null;

  const gain = Math.round(maxEl - minEl);
  const midKm = Math.round(maxDist / 2);

  return (
    <div className="flex flex-col gap-1x rounded-card bg-surface-raised/60 p-2x shadow-card">
      <div className="flex items-center justify-between gap-2x">
        <p className="flex items-center gap-1x text-label text-ink-muted">
          <Mountain className="h-3.5 w-3.5 text-accent" aria-hidden />
          Elevation profile
        </p>
        <span className="text-caption tabular-nums text-ink-muted">
          <span className="font-semibold text-ink">▲ {gain} m</span> over {Math.round(maxDist)} km
        </span>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Elevation profile from ${minEl} to ${maxEl} metres`} className="block">
        <defs>
          <linearGradient id="elevation-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Baseline */}
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />

        {/* Area fill (accent-tinted) */}
        <path d={areaPath} fill="url(#elevation-fill)" className="text-accent" />

        {/* Upcoming segment — muted */}
        {upcomingPath && (
          <path d={upcomingPath} fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        )}

        {/* Travelled segment — accent */}
        {passedPath && (
          <path d={passedPath} fill="none" className="text-accent" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        )}

        {/* Y-axis labels */}
        <text x={PAD.l - 4} y={PAD.t + 1} textAnchor="end" fontSize="11" className="fill-ink-muted tabular-nums">
          {Math.round(maxEl)} m
        </text>
        <text x={PAD.l - 4} y={H - PAD.b - 1} textAnchor="end" fontSize="11" className="fill-ink-muted tabular-nums">
          {Math.round(minEl)} m
        </text>

        {/* X-axis labels */}
        <text x={PAD.l} y={H - 6} textAnchor="middle" fontSize="11" className="fill-ink-muted tabular-nums">0</text>
        <text x={x(midKm)} y={H - 6} textAnchor="middle" fontSize="11" className="fill-ink-muted tabular-nums">
          {midKm} km
        </text>
        <text x={W - PAD.r} y={H - 6} textAnchor="middle" fontSize="11" className="fill-ink-muted tabular-nums">
          {Math.round(maxDist)} km
        </text>

        {/* Current position marker */}
        {marker && (
          <g>
            <line x1={marker.cx} y1={PAD.t} x2={marker.cx} y2={H - PAD.b} stroke="currentColor" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={marker.cx} cy={marker.cy} r="4.5" className="fill-accent" stroke="rgb(var(--surface-raised))" strokeWidth="1.5" />
            <text x={marker.cx} y={PAD.t - 3} textAnchor="middle" fontSize="11" fontWeight="600" className="fill-accent">
              now
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
