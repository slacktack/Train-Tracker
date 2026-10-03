'use client';

import { useQuery } from '@tanstack/react-query';

export interface TrainPhotoInfo {
  src: string;
  credit: string;
  license: string;
  pageUrl: string;
  exact: boolean;
}

export function useTrainPhoto(trainNumber: string, type?: string) {
  return useQuery({
    queryKey: ['train-photo', trainNumber],
    queryFn: async (): Promise<TrainPhotoInfo | null> => {
      const res = await fetch(`/api/train-image/${trainNumber}${type ? `?type=${encodeURIComponent(type)}` : ''}`);
      if (!res.ok) return null;
      const data = (await res.json()) as Partial<TrainPhotoInfo> & { src: string | null };
      return data.src ? (data as TrainPhotoInfo) : null;
    },
    staleTime: 24 * 60 * 60 * 1000,
    retry: 0,
  });
}
