import { useT } from '@/lib/i18n/useT';
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

// A single bad sample (water, bad coordinate) should not carve a spike into the profile.
function despike(points: ElevationPoint[]): ElevationPoint[] {
  return points.map((p, i) => {
    const w = [points[i - 1], p, points[i + 1]].filter(Boolean).map((q) => q!.elevationM).sort((x, y) => x - y);
    return { ...p, elevationM: w[Math.floor(w.length / 2)] };
  });
}

function smoothPath(pts: Array<[number, number]>): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${last[0].toFixed(1)},${last[1].toFixed(1)}`;
}

export function ElevationChart({ points: raw, currentKm }: ElevationChartProps) {
  const { t } = useT();
  if (raw.length < 2) return null;
  const points = despike(raw);
  const { minEl, maxEl, maxDist, x, y } = buildScale(points, W, H);
  const xy = points.map((p) => [x(p.distanceKm), y(p.elevationM)] as [number, number]);
  const line = smoothPath(xy);
  const area = `${line} L${x(maxDist).toFixed(1)},${H - PAD.b} L${x(0).toFixed(1)},${H - PAD.b} Z`;
  const inRange = currentKm != null && currentKm >= 0 && currentKm <= maxDist;
  const marker = inRange ? pointAtKm(points, currentKm as number, x, y) : null;

  return (
    <figure className="rounded-xl border border-ink/20 bg-surface-elevated/60 p-3.5">
      <figcaption className="mb-2">
        <p className="text-body font-bold">{t('chart.elevationTitle')}</p>
        <p className="text-caption text-ink-muted">{t('chart.elevationLine', { max: Math.round(maxEl), min: Math.round(minEl) })}</p>
      </figcaption>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('chart.elevationLine', { max: Math.round(maxEl), min: Math.round(minEl) })} className="block">
        <defs>
          <linearGradient id="elev-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgb(var(--ink))" stopOpacity="0.2" />
            <stop offset="1" stopColor="rgb(var(--ink))" stopOpacity="0.02" />
          </linearGradient>
          {marker && (
            <clipPath id="elev-passed">
              <rect x="0" y="0" width={marker.cx} height={H} />
            </clipPath>
          )}
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD.l} x2={W - PAD.r} y1={PAD.t + f * (H - PAD.t - PAD.b)} y2={PAD.t + f * (H - PAD.t - PAD.b)} stroke="rgb(var(--ink))" strokeOpacity="0.08" strokeDasharray="2 4" />
        ))}
        <path d={area} fill="url(#elev-fill)" />
        <path d={line} fill="none" stroke="rgb(var(--ink))" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
        {marker && <path d={line} fill="none" stroke="rgb(var(--ink))" strokeWidth="3" strokeLinecap="round" clipPath="url(#elev-passed)" />}
        <text x={PAD.l - 6} y={PAD.t + 4} textAnchor="end" fontSize="11" className="fill-ink-muted">{Math.round(maxEl)} m</text>
        <text x={PAD.l - 6} y={H - PAD.b} textAnchor="end" fontSize="11" className="fill-ink-muted">{Math.round(minEl)} m</text>
        <text x={PAD.l} y={H - 8} fontSize="11" className="fill-ink-muted">0</text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize="11" className="fill-ink-muted">{Math.round(maxDist)} km</text>
        {marker && (
          <g>
            <line x1={marker.cx} x2={marker.cx} y1={PAD.t} y2={H - PAD.b} stroke="rgb(var(--ink))" strokeOpacity="0.5" strokeDasharray="3 3" />
            <circle cx={marker.cx} cy={marker.cy} r="7" fill="rgb(var(--lamp))" stroke="rgb(var(--ink))" strokeWidth="2.5" />
            <text x={Math.min(Math.max(marker.cx, 52), W - 52)} y={PAD.t - 5} textAnchor="middle" fontSize="11" fontWeight="700" className="fill-ink">{t('chart.youAreHere')}</text>
          </g>
        )}
      </svg>
    </figure>
  );
}
