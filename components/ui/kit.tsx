'use client';

import { forwardRef, type ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, SearchX } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n/useT';
import { LanguageToggle } from '@/components/ui/LanguageToggle';

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className="relative min-h-dvh w-full pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] md:pb-10 md:pl-[5.25rem]">
      <div className="mx-auto flex w-full max-w-5xl justify-end px-4 pt-2 sm:px-6">
        <LanguageToggle />
      </div>
      <div className={cn('mx-auto w-full max-w-5xl px-4 sm:px-6', className)}>{children}</div>
    </main>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 pb-4 pt-3 sm:pt-6">
      <div className="min-w-0">
        <h1 className="font-display text-[1.75rem] font-semibold leading-8 tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-body text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export const GlassCard = forwardRef<HTMLDivElement, { children: ReactNode; className?: string; strong?: boolean } & React.HTMLAttributes<HTMLDivElement>>(
  function GlassCard({ children, className, strong, ...rest }, ref) {
    return (
      <div ref={ref} className={cn(strong ? 'glass-strong' : 'glass', 'rounded-card', className)} {...rest}>
        {children}
      </div>
    );
  },
);

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-caption font-semibold text-ink-muted', className)}>{children}</p>;
}

export function Chip({
  children,
  active,
  onClick,
  tone = 'default',
  className,
  title,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  tone?: 'default' | 'ok' | 'warn' | 'bad' | 'accent';
  className?: string;
  title?: string;
}) {
  const tones = {
    default: 'border-ink/[0.08] bg-surface-raised/60 text-ink-muted',
    accent: 'border-accent/25 bg-accent/10 text-accent',
    ok: 'border-status-onTime/30 bg-status-onTime/10 text-status-onTime',
    warn: 'border-status-minorDelay/30 bg-status-minorDelay/10 text-status-minorDelay',
    bad: 'border-status-heavyDelay/30 bg-status-heavyDelay/10 text-status-heavyDelay',
  } as const;
  const base = cn(
    'inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-caption font-semibold transition-all',
    tones[active ? 'accent' : tone],
    active && 'shadow-glow',
    onClick && 'active:scale-95 hover:border-accent/40',
    className,
  );
  if (!onClick) return <span className={base} title={title}>{children}</span>;
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={base} title={title}>
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('glass flex items-center gap-0.5 rounded-pill p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex-1 whitespace-nowrap rounded-pill px-3 py-1.5 text-caption font-semibold transition-colors',
              active ? 'pill-on' : 'text-ink-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <GlassCard className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
        <SearchX className="h-5 w-5" aria-hidden />
      </span>
      <p className="font-display text-subhead">{title}</p>
      {hint && <p className="max-w-sm text-body text-ink-muted">{hint}</p>}
      {action}
    </GlassCard>
  );
}

export function ErrorState({ message, onRetry, provider }: { message: string; onRetry?: () => void; provider?: string }) {
  const { t } = useT();
  return (
    <GlassCard role="alert" className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-status-heavyDelay/10 text-status-heavyDelay">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </span>
      <p className="font-display text-subhead">{t('common.couldntLoad')}</p>
      <p className="max-w-sm text-body text-ink-muted">{message}</p>
      {provider && <p className="text-caption text-ink-muted/70">{t('common.source')}: {provider}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1.5 rounded-pill  px-4 py-2 text-body font-semibold   transition-transform active:scale-95 cta-lamp"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden /> {t('common.retry')}
        </button>
      )}
    </GlassCard>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton', className)} />;
}
