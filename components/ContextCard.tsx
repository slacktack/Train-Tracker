import {
  Cloud,
  CloudRain,
  CloudSun,
  Droplets,
  Landmark,
  MapPin,
  Mountain,
  Moon,
  MountainSnow,
  Sunrise,
  Sunset,
  Waves,
  Wind,
} from 'lucide-react';
import { TerrainFeature, WeatherSnapshot, SunInfo } from '@/types/geo';

type ContextCardProps =
  | { variant: 'terrain'; feature: TerrainFeature }
  | { variant: 'weather'; weather: WeatherSnapshot }
  | { variant: 'sun'; sun: SunInfo };

const TERRAIN_LABELS: Record<TerrainFeature['type'], string> = {
  river: 'Crossing',
  mountain: 'Near',
  tunnel: 'Passing through',
  bridge: 'Crossing',
  tourist: 'Nearby',
  city: 'Passing',
};

const TERRAIN_ICONS: Record<TerrainFeature['type'], typeof Mountain> = {
  river: Waves,
  mountain: Mountain,
  tunnel: MountainSnow,
  bridge: Landmark,
  tourist: MapPin,
  city: Landmark,
};

function weatherIcon(condition: string): typeof Cloud {
  const c = condition.toLowerCase();
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return CloudRain;
  if (c.includes('clear') || c.includes('sun')) return CloudSun;
  return Cloud;
}

const CARD_CLASS =
  'glass flex min-w-0 flex-1 basis-40 flex-col gap-1x rounded-card px-2x py-1x shadow-card';

export function ContextCard(props: ContextCardProps) {
  if (props.variant === 'terrain') {
    const { feature } = props;
    const Icon = TERRAIN_ICONS[feature.type];
    return (
      <div className={CARD_CLASS}>
        <div className="flex items-center gap-1x">
          <Icon className="h-4 w-4 text-ink-muted" aria-hidden />
          <p className="text-caption text-ink-muted">{TERRAIN_LABELS[feature.type]}</p>
        </div>
        <p className="break-words text-subhead leading-snug">{feature.name}</p>
        {feature.distanceKm !== undefined && (
          <p className="text-caption tabular-nums text-ink-muted">{feature.distanceKm} km ahead</p>
        )}
      </div>
    );
  }

  if (props.variant === 'weather') {
    const { weather } = props;
    const Icon = weatherIcon(weather.condition);
    return (
      <div className={CARD_CLASS}>
        <div className="flex items-center gap-1x">
          <Icon className="h-4 w-4 text-status-minorDelay" aria-hidden />
          <p className="break-words text-caption leading-snug text-ink-muted">{weather.condition}</p>
        </div>
        <div className="flex items-baseline gap-0.5x">
          <p className="text-headline tabular-nums">{weather.tempC}°</p>
          <p className="text-body text-ink-muted">C</p>
        </div>
        <div className="flex items-center gap-2x text-caption tabular-nums text-ink-muted">
          <span className="flex items-center gap-0.5x">
            <Wind className="h-3.5 w-3.5" aria-hidden />
            {weather.windKmh} km/h
          </span>
          <span className="flex items-center gap-0.5x">
            <Droplets className="h-3.5 w-3.5" aria-hidden />
            {weather.precipitationMm} mm
          </span>
        </div>
        {weather.isRainingAhead && (
          <p className="text-caption font-medium text-status-minorDelay">Rain ahead</p>
        )}
      </div>
    );
  }

  const { sun } = props;
  return (
    <div className={CARD_CLASS}>
      <div className="flex items-center gap-1x">
        {sun.isNight ? (
          <Moon className="h-4 w-4 text-accent" aria-hidden />
        ) : sun.isGoldenHour ? (
          <CloudSun className="h-4 w-4 text-status-minorDelay" aria-hidden />
        ) : (
          <CloudSun className="h-4 w-4 text-status-onTime" aria-hidden />
        )}
        <p className="text-caption text-ink-muted">
          {sun.isNight ? 'Night journey' : sun.isGoldenHour ? 'Golden hour' : 'Daytime'}
        </p>
      </div>
      <div className="flex items-center gap-2x text-body tabular-nums">
        <span className="flex items-center gap-1x">
          <Sunrise className="h-4 w-4 text-ink-muted" aria-hidden />
          {sun.sunrise}
        </span>
        <span className="flex items-center gap-1x">
          <Sunset className="h-4 w-4 text-ink-muted" aria-hidden />
          {sun.sunset}
        </span>
      </div>
    </div>
  );
}
