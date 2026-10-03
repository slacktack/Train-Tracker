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
}

interface PnrStore {
  pnrs: RecentPnr[];
  push: (p: RecentPnr) => void;
  remove: (pnr: string) => void;
}

export const useRecentPnrStore = create<PnrStore>()(
  persist(
    (set) => ({
      pnrs: [],
      push: (p) => set((s) => ({ pnrs: [p, ...s.pnrs.filter((x) => x.pnr !== p.pnr)].slice(0, 8) })),
      remove: (pnr) => set((s) => ({ pnrs: s.pnrs.filter((x) => x.pnr !== pnr) })),
    }),
    { name: 'train-tracker-recent-pnrs' },
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
