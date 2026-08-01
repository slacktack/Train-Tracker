'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SearchResult } from '@/types/train';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (res.ok) setResults(await res.json());
      } catch {
        // aborted or network error — keep previous results, no error UI needed for a debounced search
      }
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  return (
    <div className="glass w-full max-w-md rounded-card p-2x">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search train number or name"
        className="w-full bg-transparent text-base outline-none placeholder:text-ink-muted"
      />
      {results.length > 0 && (
        <ul className="mt-2x max-h-80 overflow-y-auto">
          {results.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => router.push(`/track/${r.number}`)}
                className="flex w-full flex-col items-start rounded-card px-1x py-1x text-left hover:bg-surface-raised"
              >
                <span className="text-sm font-semibold">{r.number} · {r.name}</span>
                {r.origin.name && r.destination.name && (
                  <span className="text-xs text-ink-muted">{r.origin.name} → {r.destination.name}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
