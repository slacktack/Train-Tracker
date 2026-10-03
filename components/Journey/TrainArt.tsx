// Flat side-on illustration used when no photo exists. Livery follows the train kind.
export function TrainArt({ color, className }: { color: string; className?: string }) {
  const cars = [0, 1, 2];
  return (
    <svg viewBox="0 0 360 140" className={className} role="img" aria-label="Illustration of a train" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="art-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.38" />
          <stop offset="1" stopColor={color} stopOpacity="0.06" />
        </linearGradient>
      </defs>
      <rect width="360" height="140" fill="url(#art-sky)" />
      <circle cx="300" cy="34" r="16" fill="#ffd21f" opacity="0.9" />
      <path d="M0 98 L60 70 L110 92 L170 60 L240 96 L300 74 L360 98 V140 H0Z" fill={color} opacity="0.14" />
      <rect y="106" width="360" height="34" fill="#141826" opacity="0.88" />
      <rect y="104" width="360" height="3" fill="#141826" />
      {Array.from({ length: 18 }).map((_, i) => (
        <rect key={i} x={i * 22 - 4} y="118" width="10" height="3" rx="1" fill="#fff" opacity="0.22" />
      ))}
      {cars.map((i) => (
        <g key={i} transform={`translate(${28 + i * 92} 56)`}>
          <rect width="88" height="46" rx="7" fill={color} />
          <rect y="30" width="88" height="6" fill="#141826" opacity="0.28" />
          {[0, 1, 2, 3].map((w) => (
            <rect key={w} x={9 + w * 19} y="9" width="13" height="13" rx="3" fill="#fff" opacity="0.92" />
          ))}
          <circle cx="18" cy="48" r="6" fill="#141826" />
          <circle cx="70" cy="48" r="6" fill="#141826" />
        </g>
      ))}
      <g transform="translate(300 62)">
        <path d="M0 0 H34 Q50 0 54 22 V40 H0Z" fill={color} />
        <path d="M0 0 H34 Q50 0 54 22 V40 H0Z" fill="#141826" opacity="0.18" />
        <rect x="12" y="8" width="22" height="14" rx="3" fill="#fff" opacity="0.92" />
        <circle cx="49" cy="33" r="3" fill="#ffd21f" />
        <circle cx="16" cy="43" r="6" fill="#141826" />
        <circle cx="40" cy="43" r="6" fill="#141826" />
      </g>
    </svg>
  );
}
