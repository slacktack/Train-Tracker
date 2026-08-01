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

export function ContextCard(props: ContextCardProps) {
  if (props.variant === 'terrain') {
    const { feature } = props;
    return (
      <div className="glass rounded-card px-2x py-1x">
        <p className="text-xs text-ink-muted">{TERRAIN_LABELS[feature.type]}</p>
        <p className="text-base font-semibold">{feature.name}</p>
      </div>
    );
  }

  if (props.variant === 'weather') {
    const { weather } = props;
    return (
      <div className="glass rounded-card px-2x py-1x">
        <p className="text-xs text-ink-muted">{weather.condition}</p>
        <p className="text-base font-semibold tabular-nums">{weather.tempC}°C</p>
        {weather.isRainingAhead && <p className="text-xs text-status-minorDelay">Rain ahead</p>}
      </div>
    );
  }

  const { sun } = props;
  return (
    <div className="glass rounded-card px-2x py-1x">
      <p className="text-xs text-ink-muted">{sun.isNight ? 'Night journey' : sun.isGoldenHour ? 'Golden hour' : 'Daytime'}</p>
      <p className="text-base font-semibold tabular-nums">
        Sunrise {sun.sunrise} · Sunset {sun.sunset}
      </p>
    </div>
  );
}
