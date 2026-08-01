import * as SunCalc from 'suncalc';
import { SunInfo } from '@/types/geo';

function formatIST(date: Date): string {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
}

export function getSunInfo(lat: number, lng: number, date: Date = new Date()): SunInfo {
  const times = SunCalc.getTimes(date, lat, lng);
  const now = date.getTime();

  const isNight = now < times.sunrise.getTime() || now > times.sunset.getTime();
  const inMorningGolden = now >= times.sunrise.getTime() && now <= times.goldenHourEnd.getTime();
  const inEveningGolden = now >= times.goldenHour.getTime() && now <= times.sunset.getTime();

  return {
    sunrise: formatIST(times.sunrise),
    sunset: formatIST(times.sunset),
    goldenHourStart: formatIST(times.goldenHour),
    goldenHourEnd: formatIST(times.goldenHourEnd),
    isNight,
    isGoldenHour: inMorningGolden || inEveningGolden,
  };
}
