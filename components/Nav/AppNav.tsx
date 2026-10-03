'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Building2, Map, Route, Star, Ticket, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n/useT';
import type { I18nKey } from '@/lib/i18n/en';

const ITEMS: Array<{ href: string; label: I18nKey; icon: LucideIcon; match: (p: string) => boolean }> = [
  { href: '/', label: 'nav.map', icon: Map, match: (p) => p === '/' },
  { href: '/trains', label: 'nav.trains', icon: Route, match: (p) => p.startsWith('/trains') },
  { href: '/pnr', label: 'nav.pnr', icon: Ticket, match: (p) => p.startsWith('/pnr') },
  { href: '/station', label: 'nav.stations', icon: Building2, match: (p) => p.startsWith('/station') },
  { href: '/saved', label: 'nav.saved', icon: Star, match: (p) => p.startsWith('/saved') },
];

export function AppNav() {
  const pathname = usePathname() ?? '/';
  const { t } = useT();
  // The tracking screen is immersive and carries its own controls.
  if (pathname.startsWith('/track')) return null;

  return (
    <nav
      aria-label={t('nav.primary')}
      className={cn(
        'glass-strong fixed z-40 flex items-center justify-around',
        'inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] rounded-sheet px-1.5 py-1.5',
        'md:inset-x-auto md:bottom-auto md:left-3 md:top-1/2 md:w-[4.25rem] md:-translate-y-1/2 md:flex-col md:justify-center md:gap-1 md:rounded-sheet md:px-1.5 md:py-2',
      )}
    >
      {ITEMS.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-label={t(label)}
            aria-current={active ? 'page' : undefined}
            className="relative flex min-h-[48px] min-w-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[0.625rem] font-semibold md:w-full md:flex-none"
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 rounded-2xl bg-accent/15 shadow-glow"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <Icon className={cn('relative h-5 w-5 transition-colors', active ? 'text-accent' : 'text-ink-muted')} aria-hidden />
            <span className={cn('relative transition-colors', active ? 'text-accent' : 'text-ink-muted')}>{t(label)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
