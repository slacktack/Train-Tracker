'use client';

import { useQuery } from '@tanstack/react-query';

export function useTrainPhoto(trainNumber: string) {
  return useQuery({
    queryKey: ['train-photo', trainNumber],
    queryFn: async (): Promise<string | null> => {
      const res = await fetch(`/api/train-image/${trainNumber}`);
      if (!res.ok) return null;
      const data = (await res.json()) as { imageUrl: string | null };
      if (!data.imageUrl) return null;
      return `/api/train-image/${trainNumber}/img`;
    },
    staleTime: 24 * 60 * 60 * 1000,
    retry: 0,
  });
}
