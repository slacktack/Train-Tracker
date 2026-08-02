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
        'inline-flex min-h-11 items-center justify-center rounded-pill px-2x py-1x text-sm font-medium transition-colors',
        variant === 'primary' && 'bg-accent text-white hover:opacity-90',
        variant === 'ghost' && 'bg-transparent text-ink hover:bg-surface-raised',
        className
      )}
      {...props}
    />
  )
);
Button.displayName = 'Button';
