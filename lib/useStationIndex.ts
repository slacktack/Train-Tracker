'use client';

import { useEffect, useState } from 'react';
import { buildStationIndex, searchStationIndex, type StationIndexEntry, type StationRow } from '@/lib/station-search';

let indexPromise: Promise<StationIndexEntry[]> | null = null;
let indexReady: StationIndexEntry[] | null = null;

// Code-split: the ~430KB table loads once, only when a picker is first used.
export function loadStationIndex(): Promise<StationIndexEntry[]> {
  indexPromise ??= Promise.all([import('@/data/stations.json'), import('@/data/station-aliases.json')]).then(([st, al]) => {
    indexReady = buildStationIndex(st.default as unknown as Parameters<typeof buildStationIndex>[0], al.default as Record<string, string[]>);
    return indexReady;
  });
  return indexPromise;
}

export function useStationIndex(): { search: (q: string, limit?: number) => StationRow[]; ready: boolean } {
  const [index, setIndex] = useState<StationIndexEntry[] | null>(indexReady);
  useEffect(() => {
    if (index) return;
    let alive = true;
    loadStationIndex().then((i) => alive && setIndex(i));
    return () => {
      alive = false;
    };
  }, [index]);
  return { search: (q, limit = 8) => (index ? searchStationIndex(index, q, limit) : []), ready: !!index };
}
