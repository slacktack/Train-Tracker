export interface TerrainFeature {
  type: 'bridge' | 'tunnel' | 'river' | 'mountain' | 'tourist' | 'city';
  name: string;
  lat: number;
  lng: number;
  distanceKm?: number;
}

export interface WeatherSnapshot {
  tempC: number;
  condition: string;
  precipitationMm: number;
  windKmh: number;
  isRainingAhead: boolean;
}

export interface ElevationPoint {
  lat: number;
  lng: number;
  elevationM: number;
  distanceKm: number;
}

export interface SunInfo {
  sunrise: string;
  sunset: string;
  goldenHourStart: string;
  goldenHourEnd: string;
  isNight: boolean;
  isGoldenHour: boolean;
}
