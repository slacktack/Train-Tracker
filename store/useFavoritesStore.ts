import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TrainEntry } from '@/lib/trains-db';

interface FavoritesStore {
  favorites: TrainEntry[];
  addFavorite: (train: TrainEntry) => void;
  removeFavorite: (trainNumber: string) => void;
  isFavorite: (trainNumber: string) => boolean;
}

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favorites: [],
      addFavorite: (train) =>
        set((s) => (s.favorites.some((t) => t.number === train.number) ? s : { favorites: [...s.favorites, train] })),
      removeFavorite: (trainNumber) =>
        set((s) => ({ favorites: s.favorites.filter((t) => t.number !== trainNumber) })),
      isFavorite: (trainNumber) => get().favorites.some((t) => t.number === trainNumber),
    }),
    { name: 'train-tracker-favorites' }
  )
);
