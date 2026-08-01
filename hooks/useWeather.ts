'use client';

import { useQuery } from '@tanstack/react-query';
import { WeatherSnapshot } from '@/types/geo';

async function fetchWeather(lat: number, lng: number): Promise<WeatherSnapshot> {
  const res = await fetch(`/api/weather?lat=${lat}&lng=${lng}`);
  if (!res.ok) throw new Error(`Failed to fetch weather: ${res.status}`);
  return res.json();
}

export function useWeather(lat: number | undefined, lng: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['weather', lat, lng],
    queryFn: () => fetchWeather(lat as number, lng as number),
    enabled: enabled && lat !== undefined && lng !== undefined,
    refetchInterval: 7 * 60 * 1000,
  });
}
