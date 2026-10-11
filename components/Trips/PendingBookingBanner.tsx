'use client';

import Link from 'next/link';
import { Ticket, X } from 'lucide-react';
import { useT } from '@/lib/i18n/useT';
import { usePendingBooking } from '@/store/usePendingBooking';

// Return path from a partner booking: attach the new PNR to a trip.
export function PendingBookingBanner({ className }: { className?: string }) {
  const { t } = useT();
  const { pending, dismiss } = usePendingBooking();
  if (!pending) return null;
  return (
    <div className={`glass flex items-center gap-3 rounded-2xl border border-accent/25 p-3 ${className ?? ''}`} role="status">
      <Ticket className="h-5 w-5 shrink-0 text-accent" aria-hidden />
      <p className="min-w-0 flex-1 text-caption">
        <b className="block text-body">{t('trip.bookedQ', { train: `${pending.trainNo} ${pending.trainName}`, provider: pending.provider })}</b>
        {t('trip.addPnrHint')}
      </p>
      <Link href="/pnr" className="cta-lamp inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-caption font-bold">
        {t('trip.addPnr')}
      </Link>
      <button type="button" onClick={dismiss} aria-label={t('common.close')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-ink">
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
