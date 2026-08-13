import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SavedTrain } from '@/store/useFavoritesStore';

const MAX_RECENTS = 8;

interface RecentsStore {
  recents: SavedTrain[];
  pushRecent: (train: SavedTrain) => void;
  removeRecent: (trainNumber: string) => void;
}

/** Recently viewed trains — most recent first, capped, persisted locally. */
export const useRecentsStore = create<RecentsStore>()(
  persist(
    (set) => ({
      recents: [],
      pushRecent: (train) =>
        set((s) => ({
          recents: [train, ...s.recents.filter((t) => t.number !== train.number)].slice(0, MAX_RECENTS),
        })),
      removeRecent: (trainNumber) =>
        set((s) => ({ recents: s.recents.filter((t) => t.number !== trainNumber) })),
    }),
    { name: 'train-tracker-recents' }
  )
);
