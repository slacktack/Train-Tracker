interface TripStatBadgeProps {
  label: string;
  value: string;
}

export function TripStatBadge({ label, value }: TripStatBadgeProps) {
  return (
    <div className="flex flex-col gap-0.5x rounded-card bg-surface-raised px-2x py-1x shadow-card">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}
