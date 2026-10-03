'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useStationIndex } from '@/lib/useStationIndex';
import { useT } from '@/lib/i18n/useT';
import { useStationName } from '@/lib/i18n/stationNames';
import { cityMembers, cityToken, titleCase } from '@/lib/cities';
import { cn } from '@/lib/cn';
import { getJSON, type StationHit } from '@/lib/client-api';

export interface PickedStation {
  code: string;
  name: string;
}

const POPULAR: PickedStation[] = [
  { code: 'NDLS', name: 'New Delhi' },
  { code: 'CSMT', name: 'Mumbai CSMT' },
  { code: 'MMCT', name: 'Mumbai Central' },
  { code: 'HWH', name: 'Howrah Junction' },
  { code: 'MAS', name: 'Chennai Central' },
  { code: 'SBC', name: 'Bengaluru City' },
  { code: 'PUNE', name: 'Pune Junction' },
  { code: 'ADI', name: 'Ahmedabad Junction' },
  { code: 'LKO', name: 'Lucknow Charbagh' },
  { code: 'JP', name: 'Jaipur Junction' },
  { code: 'BPL', name: 'Bhopal Junction' },
  { code: 'PNBE', name: 'Patna Junction' },
];

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function StationPicker({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
  allowCity,
}: {
  label: string;
  value: PickedStation | null;
  onChange: (s: PickedStation | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** offer a "city, all stations" choice when the typed name matches several stations */
  allowCity?: boolean;
}) {
  const id = useId();
  const { t } = useT();
  const localName = useStationName();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const { search, ready } = useStationIndex();
  const q = text.trim();
  const debouncedQ = useDebounced(q, 180);

  // Local index answers instantly; the API is only a fallback while it loads.
  const { data, isFetching } = useQuery({
    queryKey: ['station-search', debouncedQ],
    queryFn: ({ signal }) => getJSON<{ results: StationHit[] }>(`/api/stations/search?q=${encodeURIComponent(debouncedQ)}`, signal),
    enabled: !ready && debouncedQ.length >= 1,
    staleTime: 5 * 60_000,
  });

  const results: PickedStation[] = q.length < 1 ? POPULAR : ready ? search(q) : (data?.results ?? []);

  const typed = q.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const city = useMemo(() => {
    if (!allowCity || !ready || typed.length < 3 || !results[0]) return null;
    const pool = search(typed, 60);
    const members = cityMembers(pool.length ? pool : [], results[0].code);
    const matching = pool.filter((m) => m.name.toLowerCase().includes(typed)).length;
    // the typed word must belong to several stations of one city, or it is just a station name
    return members.length >= 2 && matching >= 2 ? { token: cityToken(results[0].code), label: titleCase(typed), codes: members.map((m) => m.code) } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowCity, ready, typed, results.length]);
  const rows: Array<PickedStation & { city?: boolean; codes?: string[] }> = city ? [{ code: city.token, name: t('city.all', { city: city.label }), city: true, codes: city.codes }, ...results] : results;

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (s: PickedStation) => {
    onChange({ code: s.code, name: s.name });
    setText('');
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && open && rows[active]) {
      e.preventDefault();
      pick(rows[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showValue = !open && value;

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <label htmlFor={id} className={label ? "mb-1 block text-caption font-semibold text-ink-muted" : "sr-only"}>
        {label || placeholder}
      </label>
      <div
        className={cn(
          'flex h-12 items-center gap-2 rounded-2xl border border-ink/[0.08] bg-surface-raised/70 px-3 transition-all',
          open && 'border-accent/50 shadow-glow',
        )}
      >
        <MapPin className="h-4 w-4 shrink-0 text-accent" aria-hidden />
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          autoComplete="off"
          autoFocus={autoFocus}
          value={showValue ? `${localName(value.code, value.name)} (${value.code})` : text}
          placeholder={placeholder ?? t('trains.cityOrCode')}
          onFocus={(e) => {
            setOpen(true);
            e.currentTarget.select();
          }}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            if (value) onChange(null);
          }}
          onKeyDown={onKey}
          className="min-w-0 flex-1 bg-transparent text-body font-medium outline-none placeholder:text-ink-muted/60"
        />
        {!ready && isFetching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-muted" aria-hidden />}
      </div>

      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="glass-strong absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-2xl p-1.5"
        >
          {q.length < 1 && <li className="px-3 pb-1 pt-1.5 text-caption font-semibold text-ink-muted">{t('trains.popularStations')}</li>}
          {rows.length === 0 && !isFetching && <li className="px-3 py-3 text-body text-ink-muted">{t('trains.noStations', { q })}</li>}
          {rows.map((s, i) => (
            <li key={s.code} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(s)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-body transition-colors',
                  s.city ? 'mb-1 border border-dashed border-ink/40 bg-lamp/30' : '',
                  i === active ? 'bg-accent/12 text-ink' : 'text-ink',
                )}
              >
                <span className="min-w-0">
                  <span className="block break-words font-bold">{s.city ? s.name : localName(s.code, s.name)}</span>
                  {s.city && s.codes && <span className="block text-caption font-medium text-ink-muted">{t('city.sub', { codes: s.codes.join(', ') })}</span>}
                </span>
                {!s.city && <span className="shrink-0 rounded-md bg-ink/[0.06] px-1.5 py-0.5 font-mono text-caption font-semibold text-ink-muted">{s.code}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
