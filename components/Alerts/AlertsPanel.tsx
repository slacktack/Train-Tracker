'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BellRing, Smartphone, X } from 'lucide-react';
import { formatDay } from '@/lib/format';
import { useT } from '@/lib/i18n/useT';
import { disablePush, enablePush, pushSupport, type PushSupport } from '@/lib/push-client';
import type { Watch } from '@/lib/watch';
import { useWatchStore } from '@/store/useWatchStore';

function describe(w: Watch, t: ReturnType<typeof useT>['t'], lang: 'en' | 'hi') {
  const day = formatDay(w.date, lang);
  if (w.kind === 'seat') return { title: t('alerts.seatTitle', { cls: w.cls, train: `${w.train} ${w.trainName}` }), sub: `${w.from} → ${w.to} · ${day}${w.lastStatus ? ` · ${w.lastStatus}` : ''}`, href: `/trains?from=${w.from}&to=${w.to}&date=${w.date}&quota=${w.quota}` };
  if (w.kind === 'tatkal') return { title: t('alerts.tatkalTitle', { cls: w.cls, train: `${w.train} ${w.trainName}` }), sub: `${w.from} → ${w.to} · ${day}`, href: `/trains?from=${w.from}&to=${w.to}&date=${w.date}&quota=TQ` };
  return { title: t('alerts.tripTitle', { train: `${w.train} ${w.trainName}` }), sub: `${w.stationName || w.station} · ${day}${w.lastPlatform ? ` · PF ${w.lastPlatform}` : ''}`, href: `/station/${w.station}?train=${w.train}` };
}

export function AlertsPanel() {
  const { t, lang } = useT();
  const { watches, remove, push, setPush } = useWatchStore();
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pushSupport().then(setSupport);
  }, []);

  if (watches.length === 0) return null;

  const turnOn = async () => {
    setBusy(true);
    const r = await enablePush(watches).catch(() => 'unsupported' as const);
    setSupport(r);
    setPush(r === 'ok');
    setBusy(false);
  };
  const turnOff = async () => {
    setBusy(true);
    await disablePush();
    setPush(false);
    setBusy(false);
  };

  const status = push ? t('alerts.modePush') : support === 'not-configured' ? t('alerts.modeNoServer') : support === 'denied' ? t('alerts.modeDenied') : support === 'unsupported' ? t('alerts.modeUnsupported') : t('alerts.modeOpen');

  return (
    <section className="mt-6" aria-label={t('alerts.title')}>
      <h2 className="mb-2 flex items-center gap-2 text-body font-bold">
        <BellRing className="h-4 w-4" aria-hidden /> {t('alerts.title')}
      </h2>
      <div className="glass mb-2 flex flex-wrap items-center gap-3 rounded-xl p-3">
        <Smartphone className="h-5 w-5 shrink-0 text-accent" aria-hidden />
        <p className="min-w-0 flex-1 text-caption text-ink-muted" role="status">{status}</p>
        {support === 'ok' && !push && (
          <button type="button" onClick={turnOn} disabled={busy} className="cta-lamp min-h-10 rounded-lg px-3 text-caption font-bold disabled:opacity-60">
            {busy ? t('alerts.enabling') : t('alerts.enable')}
          </button>
        )}
        {push && (
          <button type="button" onClick={turnOff} disabled={busy} className="min-h-10 rounded-lg border border-ink/30 px-3 text-caption font-bold disabled:opacity-60">
            {t('alerts.disable')}
          </button>
        )}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {watches.map((w) => {
          const d = describe(w, t, lang);
          return (
            <li key={w.id} className="glass flex items-center gap-2 rounded-xl p-1.5">
              <Link href={d.href} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-lg px-2.5 hover:bg-ink/[0.05]">
                <span className="break-words text-body font-semibold">{d.title}</span>
                <span className="break-words text-caption text-ink-muted">{d.sub}</span>
              </Link>
              <button onClick={() => remove(w.id)} aria-label={`${t('common.remove')} ${d.title}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-ink">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
