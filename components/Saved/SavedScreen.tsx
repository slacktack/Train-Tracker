'use client';

import Link from 'next/link';
import { Bell, Building2, History, Route, Star, Ticket, Trash2, TrainFront, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '@/lib/i18n/useT';
import { useStationName } from '@/lib/i18n/stationNames';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useRecentsStore } from '@/store/useRecentsStore';
import { routeKey, useRecentPnrStore, useRecentRoutesStore, useStationStore } from '@/store/useRecentsExtras';
import { useAlarmStore } from '@/store/useAlarmStore';
import { EmptyState, GlassCard, PageHeader, PageShell } from '@/components/ui/kit';

function Group({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="mt-6" aria-label={title}>
      <h2 className="mb-2 flex items-center gap-2 text-body font-bold">
        {icon} {title}
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">{children}</ul>
    </section>
  );
}

function Row({ href, left, title, sub, onRemove, removeLabel }: { href?: string; left?: ReactNode; title: string; sub?: string; onRemove?: () => void; removeLabel: string }) {
  const body = (
    <>
      {left}
      <span className="min-w-0 flex-1">
        <span className="block break-words text-body font-semibold">{title}</span>
        {sub && <span className="block break-words text-caption text-ink-muted">{sub}</span>}
      </span>
    </>
  );
  return (
    <li className="glass flex items-center gap-2 rounded-xl p-1.5">
      {href ? (
        <Link href={href} className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 hover:bg-ink/[0.05]">
          {body}
        </Link>
      ) : (
        <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 px-2.5">{body}</div>
      )}
      {onRemove && (
        <button onClick={onRemove} aria-label={removeLabel} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-ink">
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </li>
  );
}

export function SavedScreen() {
  const { t } = useT();
  const local = useStationName();
  const { favorites, removeFavorite } = useFavoritesStore();
  const { recents, removeRecent } = useRecentsStore();
  const { stations, toggle: toggleStation } = useStationStore();
  const { pnrs, remove: removePnr } = useRecentPnrStore();
  const { routes, remove: removeRoute } = useRecentRoutesStore();
  const { alarms, remove: removeAlarm } = useAlarmStore();

  const total = favorites.length + recents.length + stations.length + pnrs.length + routes.length + alarms.length;
  const clearAll = () => {
    favorites.forEach((f) => removeFavorite(f.number));
    recents.forEach((r) => removeRecent(r.number));
    stations.forEach((s) => toggleStation(s));
    pnrs.forEach((p) => removePnr(p.pnr));
    routes.forEach((r) => removeRoute(routeKey(r)));
    alarms.forEach((a) => removeAlarm(a.id));
  };
  const rm = t('common.remove');

  return (
    <PageShell>
      <PageHeader title={t('saved.title')} subtitle={t('saved.subtitle')} />
      {total === 0 && <EmptyState title={t('saved.empty')} hint={t('saved.emptyHint')} />}

      {alarms.length > 0 && (
        <Group icon={<Bell className="h-4 w-4" aria-hidden />} title={t('saved.alarms')}>
          {alarms.map((a) => (
            <Row key={a.id} href={`/track/${a.trainNumber}`} title={`${a.trainNumber} ${a.trainName}`} sub={`${t('saved.alarmLine', { station: local(a.stationCode, a.stationName), lead: a.leadMin })}${a.firedAt ? ` · ${t('saved.done')}` : ''}`} onRemove={() => removeAlarm(a.id)} removeLabel={rm} />
          ))}
        </Group>
      )}
      {favorites.length > 0 && (
        <Group icon={<Star className="h-4 w-4 fill-lamp" aria-hidden />} title={t('saved.trains')}>
          {favorites.map((f) => (
            <Row key={f.number} href={`/track/${f.number}`} left={<span className="led text-[1.15rem] text-ink-muted">{f.number}</span>} title={f.name} onRemove={() => removeFavorite(f.number)} removeLabel={rm} />
          ))}
        </Group>
      )}
      {stations.length > 0 && (
        <Group icon={<Building2 className="h-4 w-4" aria-hidden />} title={t('saved.stations')}>
          {stations.map((s) => (
            <Row key={s.code} href={`/station/${s.code}`} left={<span className="led text-[1.15rem] text-ink-muted">{s.code}</span>} title={local(s.code, s.name)} onRemove={() => toggleStation(s)} removeLabel={rm} />
          ))}
        </Group>
      )}
      {routes.length > 0 && (
        <Group icon={<Route className="h-4 w-4" aria-hidden />} title={t('saved.routes')}>
          {routes.map((r) => (
            <Row key={routeKey(r)} href={`/trains?from=${r.from.code}&to=${r.to.code}`} title={`${local(r.from.code, r.from.name)} → ${local(r.to.code, r.to.name)}`} sub={`${r.from.code} → ${r.to.code}`} onRemove={() => removeRoute(routeKey(r))} removeLabel={rm} />
          ))}
        </Group>
      )}
      {pnrs.length > 0 && (
        <Group icon={<Ticket className="h-4 w-4" aria-hidden />} title={t('saved.pnrs')}>
          {pnrs.map((p) => (
            <Row key={p.pnr} href={`/pnr/${p.pnr}`} title={p.pnr} sub={p.trainName} onRemove={() => removePnr(p.pnr)} removeLabel={rm} />
          ))}
        </Group>
      )}
      {recents.length > 0 && (
        <Group icon={<History className="h-4 w-4" aria-hidden />} title={t('saved.recentTrains')}>
          {recents.map((r) => (
            <Row key={r.number} href={`/track/${r.number}`} left={<TrainFront className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />} title={`${r.number} ${r.name}`} onRemove={() => removeRecent(r.number)} removeLabel={rm} />
          ))}
        </Group>
      )}

      {total > 0 && (
        <GlassCard className="mt-8 flex items-center justify-between gap-3 p-3">
          <p className="text-caption text-ink-muted">{t('saved.subtitle')}</p>
          <button onClick={clearAll} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-ink/30 px-3 text-caption font-bold hover:bg-ink/[0.05]">
            <Trash2 className="h-4 w-4" aria-hidden /> {t('saved.clearAll')}
          </button>
        </GlassCard>
      )}
    </PageShell>
  );
}
