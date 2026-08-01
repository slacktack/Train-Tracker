interface TrainMarkerProps {
  heading: number;
  isMoving: boolean;
}

export function TrainMarker({ heading, isMoving }: TrainMarkerProps) {
  return (
    <div
      className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-accent shadow-card"
      style={{ transform: `rotate(${heading}deg)` }}
    >
      <div className={isMoving ? 'h-2 w-2 animate-pulse rounded-full bg-white' : 'h-2 w-2 rounded-full bg-white'} />
    </div>
  );
}
