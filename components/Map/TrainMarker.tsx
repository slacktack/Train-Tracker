interface TrainMarkerProps {
  heading: number;
  isMoving: boolean;
  ghost?: boolean;
}

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
        <path
          d="M12 1.5 L20.5 20.5 L12 15.5 L3.5 20.5 Z"
          fill={ghost ? 'rgb(var(--accent))' : 'rgb(var(--accent))'}
          stroke="white"
          strokeWidth="1.5"
          strokeDasharray={ghost ? '3 2' : undefined}
          strokeLinejoin="round"
        />
        <circle cx="12" cy="18.2" r="1.6" fill="white" />
      </svg>
    </div>
  );
}
