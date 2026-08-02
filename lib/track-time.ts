import { LiveJourney } from '@/types/train';

const IST_TIME_CACHE = { key: '', minutes: 0 };

function nowMinutesIST(): number {
  const key = new Date().toISOString().slice(0, 16);
  if (IST_TIME_CACHE.key === key) return IST_TIME_CACHE.minutes;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const h = parts.find((p) => p.type === 'hour')?.value ?? '0';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '0';
  const minutes = parseInt(h, 10) * 60 + parseInt(m, 10);
  IST_TIME_CACHE.key = key;
  IST_TIME_CACHE.minutes = minutes;
  return minutes;
}

function parseHHMM(hhmm: string): number | null {
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Minutes from now (IST) until `hhmm` today; a past time is treated as next day. */
export function minutesUntil(hhmm: string): number | null {
  const target = parseHHMM(hhmm);
  if (target === null) return null;
  const now = nowMinutesIST();
  return ((target - now) % 1440 + 1440) % 1440;
}

/** Seconds from now (IST) until `hhmm` today; a past time is treated as next day. */
export function secondsUntil(hhmm: string): number | null {
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  const target = h * 3600 + min * 60;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const hh = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const mm = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const ss = parseInt(parts.find((p) => p.type === 'second')?.value ?? '0', 10);
  const nowSec = hh * 3600 + mm * 60 + ss;
  return ((target - nowSec) % 86_400 + 86_400) % 86_400;
}

export function formatCountdown(totalSeconds: number): string {
  const d = Math.floor(totalSeconds / 86_400);
  const h = Math.floor((totalSeconds % 86_400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (d > 0) return `${d}d ${pad(h)}h ${pad(m)}m`;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

/** Human countdown for the journey's next station, e.g. "in 34m". */
export function countdownText(journey: LiveJourney): string | null {
  let hhmm: string | null = null;
  if (journey.status === 'not_started') {
    hhmm = journey.stations[0]?.scheduledDeparture ?? null;
  } else if (journey.status === 'running' || journey.status === 'on_time' || journey.status === 'delayed') {
    hhmm = journey.nextStation?.scheduledArrival ?? null;
  }
  if (!hhmm || hhmm === '--:--') return null;
  const minutes = minutesUntil(hhmm);
  return minutes === null ? null : `in ${formatMinutes(minutes)}`;
}
