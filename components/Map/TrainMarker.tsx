interface TrainMarkerProps {
  heading: number;
  isMoving: boolean;
  ghost?: boolean;
}

/**
 * Top-down train silhouette (elongated capsule + nose + window strip), not a
 * side-profile locomotive: a train can head any direction, and a side-view
 * silhouette rotated to face east/south reads as an unrecognizable blob. An
 * elongated top-down shape stays legible — and recognizably train-shaped —
 * at every heading.
 */
export function TrainMarker({ heading, isMoving, ghost = false }: TrainMarkerProps) {
  return (
    <div className="relative flex h-11 w-11 items-center justify-center">
      {isMoving && !ghost && (
        <span className="absolute inset-0 animate-ping rounded-full bg-accent/25" />
      )}
      {ghost && (
        <span className="absolute inset-0 rounded-full border-2 border-dashed border-accent/50" />
      )}
      <svg
        viewBox="0 0 24 24"
        className={`relative h-9 w-9 drop-shadow-lg ${ghost ? 'opacity-60' : ''}`}
        style={{ transform: `rotate(${heading}deg)` }}
      >
        {/* Body: rounded capsule, nose pointing up (travel direction) */}
        <path
          d="M12 1.6 C15 1.6 16.6 3.6 16.6 6.4 V17.6 C16.6 20.2 14.7 21.9 12 21.9 C9.3 21.9 7.4 20.2 7.4 17.6 V6.4 C7.4 3.6 9 1.6 12 1.6 Z"
          fill="rgb(var(--accent))"
          stroke="white"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        {/* Windshield */}
        <path d="M12 3.4 C13.6 3.4 14.5 4.6 14.5 6.3 L14.5 8.1 H9.5 V6.3 C9.5 4.6 10.4 3.4 12 3.4 Z" fill="white" opacity="0.95" />
        {/* Window strip */}
        <rect x="9" y="10.4" width="6" height="7.6" rx="1.4" fill="white" opacity="0.55" />
        <line x1="12" y1="10.4" x2="12" y2="18" stroke="rgb(var(--accent))" strokeWidth="0.8" opacity="0.6" />
      </svg>
    </div>
  );
}
