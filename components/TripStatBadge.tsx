import { cn } from '@/lib/cn';

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

const TONE_SURFACE: Record<NonNullable<TripStatBadgeProps['tone']>, string> = {
  good: 'bg-status-onTime/[0.06] ring-status-onTime/15',
  warn: 'bg-status-minorDelay/[0.06] ring-status-minorDelay/15',
  bad: 'bg-status-heavyDelay/[0.06] ring-status-heavyDelay/15',
};

export function TripStatBadge({ label, value, className, tone }: TripStatBadgeProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-0.5x rounded-card px-2x py-1.5x ring-1 ring-inset',
        tone
          ? TONE_SURFACE[tone]
          : 'bg-surface-raised shadow-card ring-ink/[0.06]',
        className
      )}
    >
      <span className="break-words text-label normal-case tracking-normal leading-snug text-ink-muted">
        {label}
      </span>
      <span
        className={cn(
          'break-words font-display text-stat tabular-nums sm:text-lg',
          tone ? TONE_CLASS[tone] : 'text-ink'
        )}
      >
        {value}
      </span>
    </div>
  );
}
