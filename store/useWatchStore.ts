import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { watchExpired, type Watch } from '@/lib/watch';

interface WatchStore {
  watches: Watch[];
  // Background (push) delivery is on for this browser.
  push: boolean;
  toggle: (w: Watch) => void;
  remove: (id: string) => void;
  apply: (results: Array<{ next: Watch; done: boolean }>) => void;
  setPush: (on: boolean) => void;
  prune: () => void;
}

export const useWatchStore = create<WatchStore>()(
  persist(
    (set) => ({
      watches: [],
      push: false,
      toggle: (w) => set((s) => (s.watches.some((x) => x.id === w.id) ? { watches: s.watches.filter((x) => x.id !== w.id) } : { watches: [...s.watches, w].slice(-20) })),
      remove: (id) => set((s) => ({ watches: s.watches.filter((x) => x.id !== id) })),
      apply: (results) =>
        set((s) => {
          const byId = new Map(results.map((r) => [r.next.id, r]));
          return {
            watches: s.watches.flatMap((w) => {
              const r = byId.get(w.id);
              if (!r) return [w];
              return r.done ? [] : [r.next];
            }),
          };
        }),
      setPush: (on) => set({ push: on }),
      prune: () => set((s) => ({ watches: s.watches.filter((w) => w.kind === 'tatkal' || !watchExpired(w, Date.now())) })),
    }),
    { name: 'train-tracker-watches', onRehydrateStorage: () => (state) => state?.prune() },
  ),
);
