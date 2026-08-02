interface CircularGaugeProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  children?: React.ReactNode;
}

/** Radial arc gauge (270° sweep, gauge-style) used for at-a-glance metrics like speed. */
export function CircularGauge({ value, max, size = 88, strokeWidth = 8, color, children }: CircularGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const sweep = 0.75; // 270 degrees of the circle is the visible track
  const trackLength = circumference * sweep;
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const fillLength = trackLength * pct;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-[135deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.12"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${trackLength} ${circumference}`}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${fillLength} ${circumference}`}
          style={{ transition: 'stroke-dasharray 700ms ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
