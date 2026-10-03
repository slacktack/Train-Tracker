'use client';

import { useEffect, useRef, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import type { LiveJourney, Station } from '@/types/train';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n/useT';
import { useStationName } from '@/lib/i18n/stationNames';
import { haversineKm } from '@/lib/where-now';

type Fix = { lat: number; lng: number; acc: number };

// Project the phone's GPS point onto the station-to-station polyline.
export function locateOnRoute(stations: Station[], fix: Fix) {
  const pts = stations.filter((s) => s.lat && s.lng);
  if (pts.length < 2) return null;
  let best = { dist: Infinity, i: 0, t: 0 };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const kx = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
    const ax = a.lng * kx, ay = a.lat, bx = b.lng * kx, by = b.lat, px = fix.lng * kx, py = fix.lat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    const cx = a.lng + (b.lng - a.lng) * t;
    const cy = a.lat + (b.lat - a.lat) * t;
    const dist = haversineKm(fix.lat, fix.lng, cy, cx);
    if (dist < best.dist) best = { dist, i, t };
  }
  const prev = pts[best.i];
  const next = pts[best.i + 1];
  const atStation = best.t < 0.04 ? prev : best.t > 0.96 ? next : null;
  return { offRouteKm: best.dist, prev, next, atStation, kmToNext: haversineKm(fix.lat, fix.lng, next.lat, next.lng) };
}

export function LocateMe({ journey }: { journey: LiveJourney }) {
  const { t } = useT();
  const local = useStationName();
  const [state, setState] = useState<'idle' | 'searching' | 'on' | 'denied' | 'unsupported'>('idle');
  const [fix, setFix] = useState<Fix | null>(null);
  const watchRef = useRef<number | null>(null);

  const stop = () => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    setState('idle');
    setFix(null);
  };
  useEffect(
    () => () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    },
    [],
  );

  const start = () => {
    if (!('geolocation' in navigator)) return setState('unsupported');
    setState('searching');
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        setFix({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy });
        setState('on');
      },
      (e) => setState(e.code === 1 ? 'denied' : 'searching'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  };

  const result = fix ? locateOnRoute(journey.stations, fix) : null;
  const name = (s: Station) => local(s.code, s.name);

  return (
    <section className="rounded-xl border border-ink/20 bg-surface-elevated/60 p-3.5" aria-label={t('locate.title')}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-body font-bold">
            <LocateFixed className="h-4 w-4 shrink-0" aria-hidden /> {t('locate.title')}
          </p>
          <p className="mt-0.5 text-caption text-ink-muted">{t('locate.sub')}</p>
        </div>
        <button
          type="button"
          onClick={state === 'on' || state === 'searching' ? stop : start}
          className={cn('min-h-10 shrink-0 rounded-lg px-3 text-caption font-bold', state === 'on' || state === 'searching' ? 'border border-ink/40' : 'cta-lamp')}
        >
          {state === 'on' || state === 'searching' ? t('locate.stop') : t('locate.start')}
        </button>
      </div>
      {state === 'searching' && <p className="mt-2 text-caption text-ink-muted">{t('locate.searching')}</p>}
      {state === 'denied' && <p className="mt-2 text-caption font-semibold text-status-heavyDelay">{t('locate.denied')}</p>}
      {state === 'unsupported' && <p className="mt-2 text-caption font-semibold text-status-heavyDelay">{t('locate.unsupported')}</p>}
      {state === 'on' && result && (
        <div className="mt-3 border-t border-dashed border-ink/25 pt-3" aria-live="polite">
          {result.offRouteKm > 6 ? (
            <p className="text-body font-semibold">{t('locate.offRoute')}</p>
          ) : result.atStation ? (
            <p className="text-[1.1rem] font-bold">{t('locate.at', { a: name(result.atStation) })}</p>
          ) : (
            <>
              <p className="text-[1.1rem] font-bold">{t('locate.between', { a: name(result.prev), b: name(result.next) })}</p>
              <p className="mt-0.5 text-body text-ink-muted">{t('locate.toNext', { km: Math.round(result.kmToNext), b: name(result.next) })}</p>
            </>
          )}
          {fix && <p className="mt-1 text-caption text-ink-muted">{t('locate.accuracy', { m: Math.round(fix.acc) })}</p>}
        </div>
      )}
    </section>
  );
}
