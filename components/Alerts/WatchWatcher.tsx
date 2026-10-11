'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import type { Alert, Watch } from '@/lib/watch';
import { syncPush } from '@/lib/push-client';
import { useWatchStore } from '@/store/useWatchStore';

const POLL_MS = 3 * 60_000;
const TATKAL_TICK_MS = 30_000;

// While the app is open: checks every watch and shows alerts in-app, plus a
// system notification when push isn't already delivering them.
export function WatchWatcher() {
  const watches = useWatchStore((s) => s.watches);
  const push = useWatchStore((s) => s.push);
  const [toasts, setToasts] = useState<Array<Alert & { id: string }>>([]);
  const busy = useRef(false);
  const latest = useRef<Watch[]>(watches);
  latest.current = watches;

  const ids = watches.map((w) => w.id).join('|');
  const hasTatkal = watches.some((w) => w.kind === 'tatkal');

  useEffect(() => {
    if (push) syncPush(latest.current);
  }, [ids, push]);

  useEffect(() => {
    if (!ids) return;
    const run = async () => {
      if (busy.current || document.visibilityState === 'hidden') return;
      busy.current = true;
      try {
        const res = await fetch('/api/watch/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ watches: latest.current }),
        });
        if (!res.ok) return;
        const { results } = (await res.json()) as { results: Array<{ alert: Alert | null; next: Watch; done: boolean }> };
        useWatchStore.getState().apply(results);
        for (const r of results) {
          if (!r.alert) continue;
          const alert = r.alert;
          setToasts((t) => [...t.filter((x) => x.id !== r.next.id), { ...alert, id: r.next.id }]);
          if (!push && 'Notification' in window && Notification.permission === 'granted') new Notification(alert.title, { body: alert.body, tag: r.next.id });
          navigator.vibrate?.([200, 100, 200]);
        }
      } catch {
        // offline: try again next tick
      } finally {
        busy.current = false;
      }
    };
    run();
    const id = setInterval(run, hasTatkal ? TATKAL_TICK_MS : POLL_MS);
    document.addEventListener('visibilitychange', run);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', run);
    };
  }, [ids, push, hasTatkal]);

  if (toasts.length === 0) return null;
  const close = (id: string) => setToasts((all) => all.filter((x) => x.id !== id));
  return (
    <div role="alert" aria-live="assertive" className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[61] mx-auto flex max-w-md flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="glass-strong flex items-start gap-3 rounded-card p-3 shadow-glow">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
          <Link href={t.url} onClick={() => close(t.id)} className="min-w-0 flex-1">
            <p className="text-body font-bold">{t.title}</p>
            <p className="text-caption text-ink-muted">{t.body}</p>
          </Link>
          <button onClick={() => close(t.id)} aria-label="Dismiss alert" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-ink">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
