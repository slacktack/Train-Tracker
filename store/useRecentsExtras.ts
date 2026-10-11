import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RecentRoute {
  from: { code: string; name: string };
  to: { code: string; name: string };
}

interface RoutesStore {
  routes: RecentRoute[];
  push: (r: RecentRoute) => void;
  remove: (key: string) => void;
}

export const routeKey = (r: RecentRoute) => `${r.from.code}-${r.to.code}`;

export const useRecentRoutesStore = create<RoutesStore>()(
  persist(
    (set) => ({
      routes: [],
      push: (r) => set((s) => ({ routes: [r, ...s.routes.filter((x) => routeKey(x) !== routeKey(r))].slice(0, 6) })),
      remove: (key) => set((s) => ({ routes: s.routes.filter((x) => routeKey(x) !== key) })),
    }),
    { name: 'train-tracker-recent-routes' },
  ),
);

export interface RecentPnr {
  pnr: string;
  trainName?: string;
  trainNo?: string;
  // Journey date, YYYY-MM-DD; entries expire after it.
  doj?: string;
  from?: { code: string; name: string };
  to?: { code: string; name: string };
  boarding?: { code: string; name: string };
  travelClass?: string;
  savedAt?: number;
}

interface PnrStore {
  pnrs: RecentPnr[];
  remember: boolean;
  push: (p: RecentPnr) => void;
  remove: (pnr: string) => void;
  clear: () => void;
  setRemember: (on: boolean) => void;
  prune: () => void;
}

const UNDATED_TTL_MS = 30 * 86_400_000;
const DAY_MS = 86_400_000;

export const maskPnr = (pnr: string) => `••••••${pnr.slice(-4)}`;

export function isPnrExpired(p: RecentPnr, now = Date.now()): boolean {
  if (p.doj) return Date.parse(`${p.doj}T23:59:59+05:30`) + DAY_MS < now;
  return now - (p.savedAt ?? now) > UNDATED_TTL_MS;
}

export const useRecentPnrStore = create<PnrStore>()(
  persist(
    (set) => ({
      pnrs: [],
      remember: true,
      push: (p) =>
        set((s) => (s.remember ? { pnrs: [{ ...p, savedAt: Date.now() }, ...s.pnrs.filter((x) => x.pnr !== p.pnr)].slice(0, 8) } : s)),
      remove: (pnr) => set((s) => ({ pnrs: s.pnrs.filter((x) => x.pnr !== pnr) })),
      clear: () => set({ pnrs: [] }),
      setRemember: (on) => set((s) => ({ remember: on, pnrs: on ? s.pnrs : [] })),
      prune: () => set((s) => ({ pnrs: s.pnrs.filter((x) => !isPnrExpired(x)) })),
    }),
    {
      name: 'train-tracker-recent-pnrs',
      version: 1,
      migrate: (state) => {
        const s = state as { pnrs?: RecentPnr[] };
        return { remember: true, pnrs: (s.pnrs ?? []).map((p) => ({ ...p, savedAt: p.savedAt ?? Date.now() })) } as PnrStore;
      },
      onRehydrateStorage: () => (state) => state?.prune(),
    },
  ),
);

export interface SavedStation {
  code: string;
  name: string;
}

interface StationStore {
  stations: SavedStation[];
  toggle: (s: SavedStation) => void;
  has: (code: string) => boolean;
  recents: SavedStation[];
  pushRecent: (s: SavedStation) => void;
}

export const useStationStore = create<StationStore>()(
  persist(
    (set, get) => ({
      stations: [],
      recents: [],
      toggle: (st) =>
        set((s) => ({
          stations: s.stations.some((x) => x.code === st.code) ? s.stations.filter((x) => x.code !== st.code) : [...s.stations, st],
        })),
      has: (code) => get().stations.some((x) => x.code === code),
      pushRecent: (st) => set((s) => ({ recents: [st, ...s.recents.filter((x) => x.code !== st.code)].slice(0, 6) })),
    }),
    { name: 'train-tracker-stations' },
  ),
);
