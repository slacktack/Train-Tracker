'use client';

import { Moon, Sparkles, Sun } from 'lucide-react';
import { ThemePreference, useTimeTheme } from '@/lib/useTimeTheme';
import { cn } from '@/lib/cn';

const OPTIONS: Array<{ key: ThemePreference; label: string; icon: typeof Sun }> = [
  { key: 'light', label: 'Light mode', icon: Sun },
  { key: 'auto', label: 'Auto (day/night IST)', icon: Sparkles },
  { key: 'dark', label: 'Dark mode', icon: Moon },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useTimeTheme();

  // One button that cycles, for headers too narrow for all three.
  if (compact) {
    const i = Math.max(0, OPTIONS.findIndex((o) => o.key === preference));
    const { icon: Icon, label } = OPTIONS[i];
    const next = OPTIONS[(i + 1) % OPTIONS.length];
    return (
      <button
        type="button"
        onClick={() => setPreference(next.key)}
        aria-label={`Theme: ${label}. Switch to ${next.label}`}
        title={label}
        className="glass flex h-9 w-9 shrink-0 items-center justify-center rounded-pill text-accent"
      >
        <Icon className="h-4 w-4" aria-hidden />
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="glass flex items-center gap-0.5x rounded-pill p-0.5x"
    >
      {OPTIONS.map(({ key, label, icon: Icon }) => {
        const active = preference === key;
        return (
          <button
            key={key}
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setPreference(key)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-pill transition-colors',
              active
                ? 'bg-accent/15 text-accent'
                : 'text-ink-muted hover:bg-surface-raised hover:text-ink'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
