const IST_MS = 5.5 * 3600_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function istDate(offsetDays = 0, from = Date.now()): Date {
  return new Date(from + IST_MS + offsetDays * 86_400_000);
}

/** YYYY-MM-DD in IST, `offsetDays` from today. */
export function isoDate(offsetDays = 0): string {
  return istDate(offsetDays).toISOString().slice(0, 10);
}

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

type L = 'en' | 'hi';
const locale = (lang: L) => (lang === 'hi' ? 'hi-IN' : 'en-IN');
const intl = (lang: L, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale(lang), { ...o, timeZone: 'UTC' });

/** "Sat, 10 Oct" / "शनि, 10 अक्टू" */
export function formatDay(iso: string, lang: L = 'en'): string {
  const d = isoToDate(iso);
  return `${intl(lang, { weekday: 'short' }).format(d)}, ${d.getUTCDate()} ${intl(lang, { month: 'short' }).format(d)}`;
}

export function formatChip(iso: string, offset: number, lang: L = 'en'): { top: string; bottom: string } {
  const d = isoToDate(iso);
  const top = offset === 0 ? (lang === 'hi' ? 'आज' : 'Today') : offset === 1 ? (lang === 'hi' ? 'कल' : 'Tmrw') : intl(lang, { weekday: 'short' }).format(d);
  return { top, bottom: `${d.getUTCDate()} ${intl(lang, { month: 'short' }).format(d)}` };
}

export function daysFromToday(iso: string): number {
  return Math.round((isoToDate(iso).getTime() - isoToDate(isoDate(0)).getTime()) / 86_400_000);
}

/** 395 -> "6h 35m", 14 -> "14m" (Hindi: "6 घं 35 मि"). */
export function formatDelayMin(min: number | null | undefined, lang: L = 'en'): string {
  if (min == null) return '';
  if (min <= 0) return lang === 'hi' ? 'समय पर' : 'On time';
  const h = Math.floor(min / 60);
  const m = min % 60;
  const [hs, ms] = lang === 'hi' ? ['घं', 'मि'] : ['h', 'm'];
  return h ? `${h}${lang === 'hi' ? ' ' : ''}${hs}${m ? ` ${m}${lang === 'hi' ? ' ' : ''}${ms}` : ''}` : `${m}${lang === 'hi' ? ' ' : ''}${ms}`;
}

export function delayTone(min: number | null | undefined): 'ok' | 'warn' | 'bad' | 'none' {
  if (min == null) return 'none';
  if (min < 5) return 'ok';
  if (min < 30) return 'warn';
  return 'bad';
}

export function formatInr(n: number | null | undefined): string {
  if (!n) return '';
  return `₹${new Intl.NumberFormat('en-IN').format(n)}`;
}

/** "05:15" -> minutes, for sorting. */
export function hhmmToMin(v: string | null | undefined): number {
  const m = v?.match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : Number.MAX_SAFE_INTEGER;
}

export function durationToMin(v: string | null | undefined): number {
  return hhmmToMin(v);
}

/** Accepts DD-MM-YYYY, YYYY-MM-DD, DD-Mon-YYYY or "Oct 10, 2026"; returns YYYY-MM-DD or null. */
export function toIsoDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[- ]([A-Za-z]{3})[a-z]*[- ,]+(\d{4})/);
  if (m) {
    const mi = MONTHS.findIndex((x) => x.toLowerCase() === m![2].toLowerCase());
    if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

export function seatTone(status: string): 'ok' | 'warn' | 'bad' | 'none' {
  const v = status.trim().toUpperCase();
  if (!v) return 'none';
  if (v.startsWith('CNF') || v.startsWith('CONFIRM')) return 'ok';
  if (v.startsWith('RAC')) return 'warn';
  if (v.includes('WL') || v.startsWith('WAIT') || v.startsWith('CAN') || v.startsWith('REGRET')) return 'bad';
  return 'none';
}

/** "just now" / "4 min ago" / "2 h ago" / "Sat, 10 Oct". */
export function formatAge(atMs: number | null | undefined, lang: L = 'en', now = Date.now()): string {
  if (!atMs || !Number.isFinite(atMs)) return '';
  const min = Math.max(0, Math.round((now - atMs) / 60_000));
  if (min < 1) return lang === 'hi' ? 'अभी' : 'just now';
  if (min < 60) return lang === 'hi' ? `${min} मिनट पहले` : `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return lang === 'hi' ? `${h} घंटे पहले` : `${h} h ago`;
  return formatDay(new Date(atMs + IST_MS).toISOString().slice(0, 10), lang);
}

/** Compact age for tight chips: "now", "4m", "2h". */
export function formatAgeShort(atMs: number | null | undefined, now = Date.now()): string {
  if (!atMs || !Number.isFinite(atMs)) return '';
  const min = Math.max(0, Math.round((now - atMs) / 60_000));
  if (min < 1) return 'now';
  return min < 60 ? `${min}m` : `${Math.round(min / 60)}h`;
}

// ConfirmTkt cache stamps carry no zone and are IST.
export function parseUpstreamTime(v: string | null | undefined): number | null {
  if (!v) return null;
  const zoned = /[zZ]|[+-]\d{2}:?\d{2}$/.test(v);
  const ms = Date.parse(zoned ? v : `${v}+05:30`);
  return Number.isFinite(ms) ? ms : null;
}
