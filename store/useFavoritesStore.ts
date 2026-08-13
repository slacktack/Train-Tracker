import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Minimal train identity used by favorites and recents (kept in localStorage). */
export interface SavedTrain {
  number: string;
  name: string;
}

interface FavoritesStore {
  favorites: SavedTrain[];
  addFavorite: (train: SavedTrain) => void;
  removeFavorite: (trainNumber: string) => void;
  toggleFavorite: (train: SavedTrain) => void;
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
      toggleFavorite: (train) => {
        const current = get();
        if (current.isFavorite(train.number)) current.removeFavorite(train.number);
        else current.addFavorite(train);
      },
      isFavorite: (trainNumber) => get().favorites.some((t) => t.number === trainNumber),
    }),
    { name: 'train-tracker-favorites' }
  )
);
