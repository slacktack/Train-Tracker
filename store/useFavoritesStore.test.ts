import { describe, it, expect, beforeEach } from 'vitest';
import { useFavoritesStore } from './useFavoritesStore';

const sampleTrain = { number: '12951', name: 'Rajdhani Express', from: 'Mumbai Central', fromCode: 'MMCT', to: 'New Delhi', toCode: 'NDLS' };

describe('useFavoritesStore', () => {
  beforeEach(() => {
    useFavoritesStore.setState({ favorites: [] });
  });

  it('adds a favorite', () => {
    useFavoritesStore.getState().addFavorite(sampleTrain);
    expect(useFavoritesStore.getState().favorites).toHaveLength(1);
  });

  it('does not add duplicate favorites', () => {
    useFavoritesStore.getState().addFavorite(sampleTrain);
    useFavoritesStore.getState().addFavorite(sampleTrain);
    expect(useFavoritesStore.getState().favorites).toHaveLength(1);
  });

  it('removes a favorite by train number', () => {
    useFavoritesStore.getState().addFavorite(sampleTrain);
    useFavoritesStore.getState().removeFavorite('12951');
    expect(useFavoritesStore.getState().favorites).toHaveLength(0);
  });

  it('reports isFavorite correctly', () => {
    expect(useFavoritesStore.getState().isFavorite('12951')).toBe(false);
    useFavoritesStore.getState().addFavorite(sampleTrain);
    expect(useFavoritesStore.getState().isFavorite('12951')).toBe(true);
  });
});
