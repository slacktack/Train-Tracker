'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { RefreshCcw, Search, Star, TrainFront, X } from 'lucide-react';
import { LiveTrain, StationGroup } from '@/types/train';
import { LiveMap } from '@/components/Home/LiveMap';
import { TrainDetailCard } from '@/components/Home/TrainDetailCard';
import { NationalSnapshot } from '@/components/Home/NationalSnapshot';
import { MapFilterBar, DEFAULT_FILTERS, MapFilters } from '@/components/Home/MapFilterBar';
import { StationBoard } from '@/components/Home/StationBoard';
import { CommandPalette } from '@/components/CommandPalette';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTimeTheme } from '@/lib/useTimeTheme';
import { useJourney } from '@/hooks/useJourney';
import { useFavoritesStore } from '@/store/useFavoritesStore';

const POLL_INTERVAL_MS = 30_000;
const CLOCK_TICK_MS = 30_000;

function formatUpdated(date: Date): string {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
}

function matchesFilters(t: LiveTrain, f: MapFilters): boolean {
  if (f.types.length > 0 && !f.types.includes(t.type)) return false;
  if (f.motion !== 'all' && t.src !== f.motion) return false;
  if (f.speed === 'moving' && (t.spd ?? 0) < 60) return false;
  if (f.speed === 'stopped' && (t.spd ?? 0) !== 0) return false;
  return true;
}

function groupTrainsByStation(trains: LiveTrain[]): StationGroup[] {
  const map = new Map<string, StationGroup>();
  for (const t of trains) {
    const code = t.stc || t.stn;
    if (!code) continue;
    const group = map.get(code) ?? {
      code,
      name: t.stn ?? code,
      lat: t.lat,
      lon: t.lon,
      count: 0,
      trains: [],
    };
    if (t.src === 'STATION') {
      group.lat = t.lat;
      group.lon = t.lon;
      group.name = t.stn ?? group.name;
    }
    group.count += 1;
    group.trains.push(t);
    map.set(code, group);
  }
  return Array.from(map.values())
    .map((g) => ({ ...g, trains: g.trains.sort((a, b) => a.n.localeCompare(b.n)) }))
    .sort((a, b) => b.count - a.count);
}

export default function HomePage() {
  const [trains, setTrains] = useState<LiveTrain[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<LiveTrain | null>(null);
  const [selectedStation, setSelectedStation] = useState<StationGroup | null>(null);
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { theme } = useTimeTheme();
  const router = useRouter();
  const { data: selectedJourney } = useJourney(selected?.n ?? '');
  const selectedRef = useRef<LiveTrain | null>(null);
  selectedRef.current = selected;
  const { favorites, removeFavorite } = useFavoritesStore();
  const [refreshing, setRefreshing] = useState(false);

  const [istNow, setIstNow] = useState<Date | null>(null);
  useEffect(() => {
    setIstNow(new Date());
    const id = setInterval(() => setIstNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/active-trains');
      if (!res.ok) throw new Error(`feed ${res.status}`);
      const json = await res.json();
      setTrains(json.trains ?? []);
      setCount(json.count ?? json.trains?.length ?? 0);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  const refreshNow = useCallback(async () => {
    setRefreshing(true);
    await poll();
    setRefreshing(false);
  }, [poll]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [poll]);

  useEffect(() => {
    const sel = selectedRef.current;
    if (!sel || trains.length === 0) return;
    const fresh = trains.find((t) => t.n === sel.n);
    if (fresh) setSelected(fresh);
  }, [trains]);

  // Filtered view feeds the map + snapshot; the raw feed stays for counts.
  const visibleTrains = useMemo(
    () => trains.filter((t) => matchesFilters(t, filters)),
    [trains, filters]
  );
  const stations = useMemo(() => groupTrainsByStation(visibleTrains), [visibleTrains]);

  // Keep the open station board fresh as the feed updates.
  useEffect(() => {
    if (!selectedStation) return;
    const fresh = stations.find((s) => s.code === selectedStation.code);
    if (fresh) setSelectedStation(fresh);
  }, [stations, selectedStation]);

  const topShade = theme === 'dark' ? 'from-black/60' : 'from-white/70';
  const bottomShade = theme === 'dark' ? 'from-black/50' : 'from-white/70';

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-surface">
      <LiveMap
        trains={visibleTrains}
        stations={stations}
        selectedNumber={selected?.n ?? null}
        onSelect={(t) => {
          setSelectedStation(null);
          setSelected(t);
        }}
        onSelectStation={(s) => {
          setSelected(null);
          setSelectedStation(s);
        }}
        routeGeometry={selected ? selectedJourney?.routeGeometry ?? null : null}
        theme={theme}
      />

      <div className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-44 bg-gradient-to-b ${topShade} to-transparent`} />
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-36 bg-gradient-to-t ${bottomShade} to-transparent`} />

      <header className="absolute inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-20 flex flex-col items-center gap-1x px-2x sm:px-3x">
        <div className="glass-strong flex w-full max-w-3xl flex-col gap-1x rounded-card px-2x py-1x sm:flex-row sm:items-center sm:gap-2x sm:py-1.5x">
          <div className="flex items-center gap-2x">
            <div className="flex shrink-0 items-center gap-1.5x">
              <span className="flex h-9 w-9 items-center justify-center rounded-pill bg-accent/15 shadow-glow">
                <TrainFront className="h-4 w-4 text-accent" aria-hidden />
              </span>
              <div className="hidden sm:block">
                <p className="font-display text-subhead leading-none tracking-tight">Train Tracker</p>
                <p className="mt-1 text-label normal-case tracking-wider text-ink-muted">India · Live</p>
              </div>
            </div>

            <div className="hidden shrink-0 text-right lg:block">
              {istNow && (
                <>
                  <p className="font-display text-subhead leading-none tabular-nums">{formatUpdated(istNow)}</p>
                  <p className="mt-1 text-label normal-case tracking-wider text-ink-muted">IST</p>
                </>
              )}
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1.5x sm:hidden">
              {count !== null && (
                <button
                  onClick={refreshNow}
                  aria-label="Refresh live feed"
                  className="flex shrink-0 items-center gap-1x rounded-pill border border-status-onTime/30 bg-status-onTime/10 px-2x py-1x transition-transform active:scale-95"
                >
                  {refreshing ? (
                    <RefreshCcw className="h-3.5 w-3.5 animate-spin text-status-onTime" aria-hidden />
                  ) : (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-onTime opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-status-onTime" />
                    </span>
                  )}
                  <span className="font-display text-subhead leading-none tabular-nums">
                    {new Intl.NumberFormat('en-IN').format(count)}
                  </span>
                </button>
              )}
              <ThemeToggle />
            </div>
          </div>

          <button
            onClick={() => setPaletteOpen(true)}
            className="flex h-10 min-w-0 flex-1 items-center gap-1.5x rounded-pill border border-ink/[0.08] bg-surface/70 px-2x text-body text-ink-muted shadow-sm transition-all hover:border-accent/30 hover:bg-surface-raised hover:text-ink hover:shadow-card"
          >
            <Search className="h-4 w-4 shrink-0 text-accent/70" aria-hidden />
            <span className="flex-1 text-left">Search train, number, or city</span>
            <kbd className="hidden rounded-md border border-ink-muted/20 bg-surface-raised/80 px-1x py-0.5x text-label normal-case tracking-normal text-ink-muted sm:inline-block">
              ⌘K
            </kbd>
          </button>

          {count !== null && (
            <button
              onClick={refreshNow}
              aria-label="Refresh live feed"
              className="hidden shrink-0 items-center gap-1x rounded-pill border border-status-onTime/30 bg-status-onTime/10 px-2x py-1x transition-transform active:scale-95 sm:flex"
            >
              {refreshing ? (
                <RefreshCcw className="h-3.5 w-3.5 animate-spin text-status-onTime" aria-hidden />
              ) : (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-onTime opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-status-onTime" />
                </span>
              )}
              <span className="font-display text-subhead leading-none tabular-nums">
                {new Intl.NumberFormat('en-IN').format(count)}
              </span>
              <span className="hidden text-label normal-case tracking-wider text-ink-muted sm:inline">live</span>
            </button>
          )}

          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
        </div>

        {favorites.length > 0 && (
          <div className="glass flex w-full max-w-3xl items-center gap-1x overflow-x-auto no-scrollbar rounded-card px-2x py-1x">
            <span className="flex shrink-0 items-center gap-1x text-label text-ink-muted">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
              Favourites
            </span>
            {favorites.map((f) => (
              <span key={f.number} className="flex shrink-0 items-center gap-0.5x">
                <button
                  onClick={() => router.push(`/track/${f.number}`)}
                  className="rounded-pill bg-accent/10 px-2x py-0.5x text-caption font-medium text-accent transition-colors hover:bg-accent/20"
                >
                  {f.number} · {f.name}
                </button>
                <button
                  onClick={() => removeFavorite(f.number)}
                  aria-label={`Remove ${f.name} from favorites`}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-ink-muted/50 transition-colors hover:bg-ink/10 hover:text-ink"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}

        {trains.length > 0 && (
          <div className="flex w-full max-w-3xl flex-col gap-1x">
            <NationalSnapshot trains={visibleTrains} />
            <div className="glass rounded-card px-2x py-1x">
              <MapFilterBar trains={trains} filters={filters} onChange={setFilters} />
            </div>
          </div>
        )}
      </header>

      {error && (
        <div className="absolute inset-x-0 top-3x z-30 flex justify-center px-3x pt-12x">
          <button
            onClick={poll}
            className="glass-strong rounded-pill px-3x py-1.5x text-body font-semibold text-accent shadow-glow"
          >
            Couldn&apos;t reach the live feed — tap to retry
          </button>
        </div>
      )}

      {(selected || selectedStation) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-center sm:inset-x-auto sm:bottom-auto sm:left-3x sm:top-1/2 sm:w-[min(26rem,42vw)] sm:-translate-y-1/2 sm:justify-start sm:p-0 sm:pl-3x">
          <div className="pointer-events-auto w-full max-w-xl sm:max-w-none">
            <AnimatePresence mode="wait">
              {selected ? (
                <TrainDetailCard
                  key={selected.n}
                  train={selected}
                  onClose={() => setSelected(null)}
                  onTrack={(n) => router.push(`/track/${n}`)}
                />
              ) : selectedStation ? (
                <StationBoard
                  key={selectedStation.code}
                  station={selectedStation}
                  onClose={() => setSelectedStation(null)}
                  onSelectTrain={(t) => {
                    setSelectedStation(null);
                    setSelected(t);
                  }}
                />
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      )}

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </main>
  );
}
