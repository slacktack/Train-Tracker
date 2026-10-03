'use client';

import { useEffect, useRef, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import type { LiveJourney } from '@/types/train';
import { hhmmToMin } from '@/lib/format';
import { useAlarmStore, type Alarm } from '@/store/useAlarmStore';

const POLL_MS = 60_000;

function istNowMin(): number {
  const d = new Date(Date.now() + 5.5 * 3600_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

// Minutes until a clock time, tolerating up to 2h in the past.
export function minutesUntil(hhmm: string | undefined): number | null {
  if (!hhmm || hhmm === '--:--') return null;
  const m = hhmmToMin(hhmm);
  if (m === Number.MAX_SAFE_INTEGER) return null;
  return ((m - istNowMin() + 1440 + 120) % 1440) - 120;
}

async function check(alarm: Alarm): Promise<{ fire: boolean; expire: boolean; eta: string | null }> {
  const res = await fetch(`/api/journey/${alarm.trainNumber}`);
  if (!res.ok) return { fire: false, expire: false, eta: null };
  const journey = (await res.json()) as LiveJourney;
  const st = journey.stations.find((s) => s.code === alarm.stationCode);
  if (!st) return { fire: false, expire: true, eta: null };
  if (st.status === 'passed') return { fire: false, expire: true, eta: null };
  const eta = st.actualArrival ?? st.scheduledArrival;
  const mins = minutesUntil(eta);
  return { fire: st.status === 'current' || (mins !== null && mins <= alarm.leadMin && mins > -30), expire: false, eta };
}

export function AlarmWatcher() {
  const alarms = useAlarmStore((s) => s.alarms);
  const { markFired, prune } = useAlarmStore();
  const [toasts, setToasts] = useState<Array<{ id: string; text: string }>>([]);
  const busy = useRef(false);

  useEffect(() => {
    prune();
  }, [prune]);

  const pending = alarms.filter((a) => !a.firedAt);

  useEffect(() => {
    if (pending.length === 0) return;
    const run = async () => {
      if (busy.current || document.visibilityState === 'hidden') return;
      busy.current = true;
      try {
        for (const a of pending) {
          const r = await check(a).catch(() => null);
          if (!r) continue;
          if (r.fire) {
            const text = `${a.trainName || a.trainNumber} reaches ${a.stationName}${r.eta ? ` at ${r.eta}` : ' soon'}.`;
            markFired(a.id);
            setToasts((t) => [...t, { id: a.id, text }]);
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Arriving soon', { body: text, tag: a.id });
            }
            navigator.vibrate?.([200, 100, 200]);
          } else if (r.expire) {
            markFired(a.id);
          }
        }
      } finally {
        busy.current = false;
      }
    };
    run();
    const id = setInterval(run, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.map((a) => a.id).join('|')]);

  if (toasts.length === 0) return null;
  return (
    <div role="alert" aria-live="assertive" className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] mx-auto flex max-w-md flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="glass-strong flex items-start gap-3 rounded-card p-3 shadow-glow">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
          <p className="flex-1 text-body font-semibold">{t.text}</p>
          <button onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} aria-label="Dismiss alert" className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:text-ink">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
