'use client';

import { QueryClient, QueryClientProvider, dehydrate, hydrate } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

const KEY = 'tt-query-cache-v1';
const KEEP = new Set(['journey', 'board', 'between', 'pnr', 'schedule', 'seats', 'trends', 'train-photo', 'coach-summary']);
const MAX_AGE_MS = 24 * 3600_000;
const MAX_BYTES = 2_500_000;

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, gcTime: MAX_AGE_MS, networkMode: 'offlineFirst' } },
      }),
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { at: number; state: Parameters<typeof hydrate>[1] };
        if (Date.now() - saved.at < MAX_AGE_MS) hydrate(client, saved.state);
      }
    } catch {
      // corrupt or unavailable storage: start empty
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    const save = () => {
      timer = null;
      try {
        const state = dehydrate(client, {
          shouldDehydrateQuery: (q) => q.state.status === 'success' && KEEP.has(String(q.queryKey[0])),
        });
        const json = JSON.stringify({ at: Date.now(), state });
        if (json.length < MAX_BYTES) localStorage.setItem(KEY, json);
      } catch {
        // quota exceeded: skip this save
      }
    };
    const unsub = client.getQueryCache().subscribe(() => {
      if (!timer) timer = setTimeout(save, 4000);
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
