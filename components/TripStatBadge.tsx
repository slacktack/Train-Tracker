interface TripStatBadgeProps {
  label: string;
  value: string;
  className?: string;
  tone?: 'good' | 'warn' | 'bad';
}

const TONE_CLASS: Record<NonNullable<TripStatBadgeProps['tone']>, string> = {
  good: 'text-status-onTime',
  warn: 'text-status-minorDelay',
  bad: 'text-status-heavyDelay',
};

export function TripStatBadge({ label, value, className, tone }: TripStatBadgeProps) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5x rounded-card bg-surface-raised px-2x py-1x shadow-card ${className ?? ''}`}>
      <span className="break-words text-label normal-case tracking-normal leading-snug text-ink-muted">{label}</span>
      <span className={`break-words text-stat tabular-nums sm:text-lg ${tone ? TONE_CLASS[tone] : ''}`}>{value}</span>
    </div>
  );
}
