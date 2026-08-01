'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { LiveJourney } from '@/types/train';

async function fetchJourney(trainNumber: string): Promise<LiveJourney> {
  const res = await fetch(`/api/journey/${trainNumber}`);
  if (!res.ok) throw new Error(`Failed to fetch journey: ${res.status}`);
  return res.json();
}

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const handler = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);
  return visible;
}

export function useJourney(trainNumber: string) {
  const visible = usePageVisible();

  return useQuery({
    queryKey: ['journey', trainNumber],
    queryFn: () => fetchJourney(trainNumber),
    refetchInterval: visible ? 18_000 : false,
    enabled: !!trainNumber,
  });
}
