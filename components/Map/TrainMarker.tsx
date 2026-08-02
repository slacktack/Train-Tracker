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
      {/* Side-profile locomotive drawn nose-up so heading rotation points along
          travel direction. */}
      <svg
        viewBox="0 0 24 24"
        className={`relative h-9 w-9 drop-shadow-lg ${ghost ? 'opacity-60' : ''}`}
        style={{ transform: `rotate(${heading}deg)` }}
      >
        {/* Cab / nose */}
        <path
          d="M5.2 6.8 V3.6 L7 1.8 H17 L18.8 3.6 V6.8 Z"
          fill="rgb(var(--accent))"
          stroke="white"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        {/* Body */}
        <path
          d="M3 6.8 H21 V14.2 Q21 15.7 19.6 15.7 H4.4 Q3 15.7 3 14.2 Z"
          fill="rgb(var(--accent))"
          stroke="white"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        {/* Window */}
        <rect x="6.4" y="8.4" width="11.2" height="3.1" rx="1.2" fill="white" opacity="0.92" />
        {/* Headlight */}
        <circle cx="17.2" cy="5.1" r="0.9" fill="white" opacity="0.9" />
        {/* Skirt */}
        <path
          d="M4.6 15.7 H19.4 V17.5 H4.6 Z"
          fill="rgb(var(--accent))"
          stroke="white"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        {/* Wheels */}
        <circle
          cx="8.7"
          cy="19.5"
          r="2.1"
          fill="rgb(var(--accent))"
          stroke="white"
          strokeWidth="1.2"
        />
        <circle
          cx="15.3"
          cy="19.5"
          r="2.1"
          fill="rgb(var(--accent))"
          stroke="white"
          strokeWidth="1.2"
        />
      </svg>
    </div>
  );
}
