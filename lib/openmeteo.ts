import { WeatherSnapshot } from '@/types/geo';

const WMO_CONDITIONS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm',
};

export function mapWeatherCode(code: number): string {
  return WMO_CONDITIONS[code] ?? 'Unknown';
}

export function isRainCode(code: number): boolean {
  return code >= 51 && code < 100;
}

export async function getWeatherSnapshot(lat: number, lng: number): Promise<WeatherSnapshot> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,wind_speed_10m,weather_code`;
  const res = await fetch(url, { next: { revalidate: 300 } } as any);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const json = await res.json();
  const current = json.current;
  const code = current.weather_code as number;

  return {
    tempC: Math.round(current.temperature_2m),
    condition: mapWeatherCode(code),
    precipitationMm: current.precipitation ?? 0,
    windKmh: Math.round(current.wind_speed_10m ?? 0),
    isRainingAhead: isRainCode(code),
  };
}
