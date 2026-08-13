'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { LiveJourney } from '@/types/train';

async function fetchJourney(trainNumber: string, date?: string): Promise<LiveJourney> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  const res = await fetch(`/api/journey/${trainNumber}${qs}`);
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

/**
 * Live journey for a train. `date` (DD-Mmm-YYYY) optionally pins the journey
 * to a specific start date — used by the date chips on the tracking screen
 * when a train's real journey started on an earlier day.
 */
export function useJourney(trainNumber: string, date?: string) {
  const visible = usePageVisible();

  return useQuery({
    queryKey: ['journey', trainNumber, date ?? 'auto'],
    queryFn: () => fetchJourney(trainNumber, date),
    refetchInterval: visible ? 18_000 : false,
    enabled: !!trainNumber,
    staleTime: 10_000,
  });
}
