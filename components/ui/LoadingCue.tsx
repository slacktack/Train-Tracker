import { cn } from '@/lib/cn';

interface LoadingCueProps {
  /** Short message shown next to the live-fetch indicator */
  label?: string;
  className?: string;
  /** Compact = single-line inline cue; block = padded card-style cue */
  size?: 'inline' | 'block';
}

/**
 * Consistent "still fetching live data" cue used across every popup/card.
 * Replaces ad-hoc pulse dots and bare "Searching…" text so loading always
 * reads the same way: animated live dot + clear label.
 */
export function LoadingCue({
  label = 'Fetching live status…',
  className,
  size = 'inline',
}: LoadingCueProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1.5x text-caption text-ink-muted',
        size === 'block' &&
          'w-full justify-center rounded-card border border-ink/[0.06] bg-surface-raised/60 px-2x py-2x',
        className
      )}
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/50" />
        <span className="live-dot relative inline-flex h-2 w-2 rounded-full bg-accent" />
      </span>
      <span className="leading-snug">{label}</span>
    </span>
  );
}

interface LoadingSkeletonProps {
  className?: string;
  /** Accessible label for screen readers */
  label?: string;
}

/** Shimmer placeholder block for async panels (weather, elevation, coaches…). */
export function LoadingSkeleton({ className, label = 'Loading' }: LoadingSkeletonProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn('skeleton', className)}
    />
  );
}
