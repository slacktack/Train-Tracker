'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CornerDownLeft, History, Star, X } from 'lucide-react';
import { SearchResult } from '@/types/train';
import { cn } from '@/lib/cn';
import { LoadingCue } from '@/components/ui/LoadingCue';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useRecentsStore } from '@/store/useRecentsStore';

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function RunsOnMini({ runsOn }: { runsOn?: string[] }) {
  if (!runsOn || runsOn.length === 0) return null;
  const set = new Set(runsOn);
  return (
    <span className="mt-0.5x inline-flex flex-wrap items-center gap-0.5x">
      {DAY_ORDER.map((d) => (
        <span
          key={d}
          className={
            set.has(d)
              ? 'rounded bg-accent/15 px-1 text-caption font-semibold text-accent'
              : 'rounded px-1 text-caption text-ink-muted/40'
          }
        >
          {d}
        </span>
      ))}
    </span>
  );
}

function liveNoteTone(liveNote?: string): string {
  if (!liveNote) return '';
  if (liveNote.startsWith('Running')) return 'text-status-onTime';
  if (liveNote.startsWith('Departs today') || liveNote.startsWith('Runs today')) return 'text-accent';
  if (liveNote.startsWith('At ')) return 'text-accent';
  return 'text-ink-muted';
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      setInternalOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange]
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const favorites = useFavoritesStore((s) => s.favorites);
  const recents = useRecentsStore((s) => s.recents);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!isOpenRef.current);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelected(0);
      setLoading(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as SearchResult[];
        setResults(data);
        setSelected(0);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) setResults([]);
      } finally {
        setLoading(false);
      }
    }, 120);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, isOpen]);

  const goTo = useCallback(
    (trainNumber: string) => {
      setOpen(false);
      router.push(`/track/${trainNumber}`);
    },
    [router, setOpen]
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => Math.min(results.length - 1, s + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => Math.max(0, s - 1));
      } else if (e.key === 'Enter' && results[selected]) {
        e.preventDefault();
        goTo(results[selected].number);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, results, selected, goTo]);

  if (!isOpen) return null;

  const showQuickPicks = !query.trim() && (favorites.length > 0 || recents.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center sm:px-3x sm:pt-[14vh]">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search trains"
        className="relative flex h-full w-full flex-col overflow-hidden bg-surface-raised/95 shadow-premium backdrop-blur-xl sm:h-auto sm:max-h-[70vh] sm:max-w-lg sm:rounded-card sm:border sm:border-ink/[0.08]"
      >
        <div className="flex shrink-0 items-center gap-2x border-b border-ink/[0.08] px-3x py-2x sm:pt-3x">
          <Search className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search train, number, or city…"
            className="w-full bg-transparent text-body text-ink outline-none placeholder:text-ink-muted/50"
            aria-label="Search trains by number, name, or city"
          />
          {loading && <LoadingCue label="Searching…" className="hidden shrink-0 sm:inline-flex" />}
          <kbd className="hidden shrink-0 rounded-md border border-ink/[0.08] bg-surface px-1x py-0.5x text-label normal-case tracking-normal text-ink-muted sm:inline-block">
            ESC
          </kbd>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close search"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink sm:hidden"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1x pb-[calc(env(safe-area-inset-bottom)+12px)]">
          {showQuickPicks && (
            <div className="flex flex-col gap-1x px-1x pt-1x">
              {favorites.length > 0 && (
                <div>
                  <p className="flex items-center gap-1x px-1.5x pb-0.5x text-label text-ink-muted">
                    <Star className="h-3 w-3" aria-hidden /> Favorites
                  </p>
                  {favorites.map((f) => (
                    <button
                      key={f.number}
                      onClick={() => goTo(f.number)}
                      className="flex w-full items-center gap-2x rounded-card px-1.5x py-1x text-left transition-colors hover:bg-accent/10"
                    >
                      <span className="shrink-0 rounded-md bg-accent/15 px-1.5x py-0.5x text-caption font-semibold tabular-nums text-accent">
                        {f.number}
                      </span>
                      <span className="min-w-0 flex-1 break-words text-body font-medium text-ink">{f.name}</span>
                      <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-accent/70" aria-hidden />
                    </button>
                  ))}
                </div>
              )}
              {recents.length > 0 && (
                <div>
                  <p className="flex items-center gap-1x px-1.5x pb-0.5x pt-1x text-label text-ink-muted">
                    <History className="h-3 w-3" aria-hidden /> Recently viewed
                  </p>
                  {recents.map((r) => (
                    <button
                      key={r.number}
                      onClick={() => goTo(r.number)}
                      className="flex w-full items-center gap-2x rounded-card px-1.5x py-1x text-left transition-colors hover:bg-accent/10"
                    >
                      <span className="shrink-0 rounded-md bg-ink-muted/10 px-1.5x py-0.5x text-caption font-semibold tabular-nums text-ink-muted">
                        {r.number}
                      </span>
                      <span className="min-w-0 flex-1 break-words text-body font-medium text-ink">{r.name}</span>
                      <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-accent/70" aria-hidden />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!showQuickPicks && loading && results.length === 0 && (
            <div className="px-2x py-3x">
              <LoadingCue size="block" label="Searching live trains…" />
            </div>
          )}
          {!showQuickPicks && !loading && results.length === 0 && (
            <div className="px-2x py-2x text-caption text-ink-muted">
              {query ? (
                <>
                  <p>No match for &quot;{query}&quot;.</p>
                  {!/^\d+$/.test(query.trim()) && (
                    <p className="mt-0.5x">
                      Name/city search only covers currently-running and popular trains — try its 5-digit train number instead.
                    </p>
                  )}
                </>
              ) : (
                <p>Type a train number, name, or city</p>
              )}
            </div>
          )}
          {!showQuickPicks &&
            results.map((r, i) => (
              <button
                key={r.id}
                onClick={() => goTo(r.number)}
                onMouseEnter={() => setSelected(i)}
                className={cn(
                  'flex w-full items-center gap-2x rounded-card px-2x py-1.5x text-left transition-colors',
                  i === selected && 'bg-accent/10 ring-1 ring-inset ring-accent/15'
                )}
              >
                <span className="shrink-0 rounded-md bg-accent/15 px-1.5x py-0.5x text-caption font-semibold tabular-nums text-accent">
                  {r.number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-body font-medium text-ink">{r.name}</span>
                  {r.origin.name && r.destination.name && (
                    <span className="block break-words text-caption text-ink-muted">
                      {r.origin.name} → {r.destination.name}
                      {r.duration ? ` · ${r.duration}` : ''}
                    </span>
                  )}
                  {r.liveNote && (
                    <span
                      className={cn(
                        'mt-0.5x inline-block text-label normal-case tracking-normal',
                        liveNoteTone(r.liveNote)
                      )}
                    >
                      {r.liveNote}
                      {r.departureTime ? ` · dep ${r.departureTime}` : ''}
                    </span>
                  )}
                  <RunsOnMini runsOn={r.runsOn} />
                </span>
                {i === selected && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />}
              </button>
            ))}
        </div>

        <div className="hidden items-center gap-2x border-t border-ink/[0.08] px-3x py-1x text-label normal-case tracking-normal text-ink-muted sm:flex">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span className="ml-auto">⌘K anywhere</span>
        </div>
      </div>
    </div>
  );
}
