import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex min-h-11 items-center justify-center rounded-pill px-3x py-1x text-sm font-semibold tracking-tight transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        'disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' &&
          '   active:scale-[0.98] cta-lamp',
        variant === 'ghost' &&
          'bg-transparent text-ink hover:bg-ink/[0.06] active:bg-ink/[0.1]',
        className
      )}
      {...props}
    />
  )
);
Button.displayName = 'Button';
