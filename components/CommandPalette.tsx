'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CornerDownLeft, X } from 'lucide-react';
import { SearchResult } from '@/types/train';
import { cn } from '@/lib/cn';

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-3x pt-[14vh]">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search trains"
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-ink/10 bg-surface-raised/95 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center gap-2x border-b border-ink/10 px-3x py-2x">
          <Search className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search train number or name…"
            className="w-full bg-transparent text-body text-ink outline-none placeholder:text-ink-muted/50"
            aria-label="Search trains by number or name"
          />
          <kbd className="hidden shrink-0 rounded-md border border-ink/10 bg-surface-raised px-1x py-0.5x text-label normal-case tracking-normal text-ink-muted sm:inline-block">
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

        <div className="max-h-[46vh] overflow-y-auto p-1x">
          {loading && <p className="px-2x py-2x text-caption text-ink-muted">Searching…</p>}
          {!loading && results.length === 0 && (
            <p className="px-2x py-2x text-caption text-ink-muted">
              {query ? 'No trains found' : 'Type a train number or name'}
            </p>
          )}
          {results.map((r, i) => (
            <button
              key={r.id}
              onClick={() => goTo(r.number)}
              onMouseEnter={() => setSelected(i)}
              className={cn(
                'flex w-full items-center gap-2x rounded-xl px-2x py-1x text-left transition-colors',
                i === selected && 'bg-ink/10'
              )}
            >
              <span className="shrink-0 rounded-md bg-accent/20 px-1x py-0.5x text-caption font-semibold tabular-nums text-accent">
                {r.number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-body text-ink">{r.name}</span>
                {r.origin.name && r.destination.name && (
                  <span className="block break-words text-caption text-ink-muted">
                    {r.origin.name} → {r.destination.name}
                  </span>
                )}
              </span>
              {i === selected && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />}
            </button>
          ))}
        </div>

        <div className="hidden items-center gap-2x border-t border-ink/10 px-3x py-1x text-label normal-case tracking-normal text-ink-muted sm:flex">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span className="ml-auto">⌘K anywhere</span>
        </div>
      </div>
    </div>
  );
}
