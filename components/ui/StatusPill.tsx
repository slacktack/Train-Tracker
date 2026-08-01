import { LiveJourney } from '@/types/train';
import { cn } from '@/lib/cn';

interface StatusPillProps {
  status: LiveJourney['status'];
  delayMinutes: number;
}

export function statusLabel(status: LiveJourney['status'], delayMinutes: number): {
  label: string;
  colorClass: string;
} {
  if (status === 'cancelled') return { label: 'Cancelled', colorClass: 'bg-status-heavyDelay' };
  if (status === 'not_started') return { label: 'Not started', colorClass: 'bg-ink-muted' };
  if (status === 'completed') return { label: 'Completed', colorClass: 'bg-ink-muted' };
  if (delayMinutes >= 15) return { label: `Delayed ${delayMinutes}m`, colorClass: 'bg-status-heavyDelay' };
  if (delayMinutes >= 1) return { label: `Delayed ${delayMinutes}m`, colorClass: 'bg-status-minorDelay' };
  return { label: 'On time', colorClass: 'bg-status-onTime' };
}

export function StatusPill({ status, delayMinutes }: StatusPillProps) {
  const { label, colorClass } = statusLabel(status, delayMinutes);
  return (
    <span className={cn('inline-flex items-center gap-1x rounded-pill px-2x py-0.5x text-xs font-semibold text-white', colorClass)}>
      {label}
    </span>
  );
}
