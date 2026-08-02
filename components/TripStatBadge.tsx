interface TripStatBadgeProps {
  label: string;
  value: string;
  className?: string;
}

export function TripStatBadge({ label, value, className }: TripStatBadgeProps) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5x rounded-card bg-surface-raised px-2x py-1x shadow-card ${className ?? ''}`}>
      <span className="truncate text-xs text-ink-muted">{label}</span>
      <span className="truncate text-base font-semibold tabular-nums sm:text-lg">{value}</span>
    </div>
  );
}
