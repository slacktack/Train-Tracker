'use client';

import type { LiveJourney } from '@/types/train';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n/useT';
import { useStationName } from '@/lib/i18n/stationNames';
import { humanMinutes, whereNow } from '@/lib/where-now';
import { formatDelayMin } from '@/lib/format';
import { StatusPill } from '@/components/ui/StatusPill';

export function WhereNowCard({ journey, className }: { journey: LiveJourney; className?: string }) {
  const { t, lang } = useT();
  const local = useStationName();
  const w = whereNow(journey);
  const estimated = journey.currentLocation.positionSource === 'projected' || journey.currentLocation.positionSource === 'none';
  const name = (code: string, fallback: string) => local(code, fallback);

  let headline = '';
  let detail: string | null = null;
  let eta: string | null = null;

  if (w.kind === 'cancelled') headline = t('where.cancelled');
  else if (w.kind === 'completed') headline = t('where.completed', { station: name(w.station.code, w.station.name) });
  else if (w.kind === 'notStarted') headline = t('where.notStarted', { station: name(w.station.code, w.station.name), time: w.time });
  else if (w.kind === 'at') {
    headline = w.station.platform
      ? t('where.atPf', { station: name(w.station.code, w.station.name), pf: w.station.platform })
      : t('where.at', { station: name(w.station.code, w.station.name) });
    if (w.next) eta = t('where.reaches', { b: name(w.next.code, w.next.name), time: w.next.actualArrival ?? w.next.scheduledArrival }) + (w.etaMin != null && w.etaMin >= 0 ? ` (${t('where.in', { x: humanMinutes(w.etaMin, lang) })})` : '');
  } else {
    headline = w.prev
      ? t('where.between', { a: name(w.prev.code, w.prev.name), b: name(w.next.code, w.next.name) })
      : t('where.beforeFirst', { b: name(w.next.code, w.next.name) });
    if (w.km != null) detail = t('where.km', { km: w.km });
    eta = t('where.reaches', { b: name(w.next.code, w.next.name), time: w.time }) + (w.etaMin != null && w.etaMin >= 0 ? ` (${t('where.in', { x: humanMinutes(w.etaMin, lang) })})` : '');
  }

  const running = w.kind === 'between' || w.kind === 'at';
  const late = journey.delayMinutes;

  return (
    <section className={cn('rounded-xl border border-ink/20 bg-surface-elevated/70 p-3.5', className)} aria-label={t('where.title')} aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-caption font-semibold text-ink-muted">
            {running && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="ping-soft absolute inline-flex h-full w-full rounded-full bg-status-onTime" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-status-onTime" />
              </span>
            )}
            {t('where.title')}
          </p>
          <p className="mt-1.5 break-words text-[1.2rem] font-bold leading-snug">{headline}</p>
          {detail && <p className="mt-1 text-body font-semibold text-ink-muted">{detail}</p>}
          {eta && <p className="mt-0.5 break-words text-body text-ink-muted">{eta}</p>}
        </div>
        <StatusPill status={journey.status} delayMinutes={journey.delayMinutes} />
      </div>
      {running && (
        <p className="mt-2.5 text-caption font-medium text-ink-muted">
          {late > 0 ? t('where.late', { m: formatDelayMin(late, lang) }) : t('where.early')}
          {'. '}
          {estimated ? t('where.estimated') : t('where.live')}
        </p>
      )}
    </section>
  );
}
