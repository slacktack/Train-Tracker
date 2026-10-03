'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { LiveTrain, StationGroup } from '@/types/train';
import { LiveMap } from '@/components/Home/LiveMap';
import { TrainDetailCard } from '@/components/Home/TrainDetailCard';
import { RefreshCcw, Search, TrainFront } from 'lucide-react';
import { HomePanel } from '@/components/Home/HomePanel';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { useT } from '@/lib/i18n/useT';
import { DEFAULT_FILTERS, MapFilters } from '@/components/Home/MapFilterBar';
import { StationBoard } from '@/components/Home/StationBoard';
import { CommandPalette } from '@/components/CommandPalette';
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
    // Only trains standing at a station mark one; a moving train's nearest station is not where it is.
    if (t.src !== 'STATION') continue;
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
  const [stale, setStale] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  useEffect(() => {
    try {
      setPanelCollapsed(localStorage.getItem('tt-panel-collapsed') === '1');
    } catch {
      // storage unavailable
    }
  }, []);
  const togglePanel = useCallback(() => {
    setPanelCollapsed((v) => {
      try {
        localStorage.setItem('tt-panel-collapsed', v ? '0' : '1');
      } catch {
        // ignore
      }
      return !v;
    });
  }, []);
  const { t } = useT();
  const [selected, setSelected] = useState<LiveTrain | null>(null);
  const [selectedStation, setSelectedStation] = useState<StationGroup | null>(null);
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { theme } = useTimeTheme();
  const router = useRouter();
  const { data: selectedJourney } = useJourney(selected?.n ?? '');
  const selectedRef = useRef<LiveTrain | null>(null);
  selectedRef.current = selected;
  const { favorites } = useFavoritesStore();
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
      try {
        localStorage.setItem('tt-feed-v1', JSON.stringify({ at: Date.now(), trains: json.trains ?? [] }));
      } catch {
        // storage full: the live view still works
      }
      setTrains(json.trains ?? []);
      setCount(json.count ?? json.trains?.length ?? 0);
      setStale(!!json.stale);
      setError(false);
    } catch {
      setError(true);
      try {
        const saved = JSON.parse(localStorage.getItem('tt-feed-v1') ?? 'null') as { at: number; trains: LiveTrain[] } | null;
        if (saved && saved.trains.length > 0) {
          setTrains((cur) => (cur.length > 0 ? cur : saved.trains));
          setStale(true);
        }
      } catch {
        // nothing saved
      }
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
        journey={selected ? selectedJourney ?? null : null}
        theme={theme}
      />

      <header className={`absolute inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-20 flex flex-col items-center gap-1x px-2x sm:px-3x ${selected || selectedStation ? 'md:pl-[33.5rem]' : 'md:pl-[5rem]'} transition-[padding] duration-300 ${panelCollapsed ? 'md:pr-[3.5rem]' : 'md:pr-[24.5rem]'}`}>
        <div className="glass-strong flex w-full max-w-3xl flex-col gap-1x rounded-card px-2x py-1x xl:flex-row xl:items-center xl:gap-2x xl:py-1.5x">
          <div className="flex items-center gap-2x">
            <div className="flex shrink-0 items-center gap-1.5x">
              <span className="flex h-9 w-9 items-center justify-center rounded-pill bg-accent/15 shadow-glow">
                <TrainFront className="h-4 w-4 text-accent" aria-hidden />
              </span>
              <div className="hidden 2xl:block">
                <p className="font-display text-subhead leading-none tracking-tight">{t('home.title')}</p>
                <p className="mt-1 text-label normal-case tracking-wider text-ink-muted">{t('home.tagline')}</p>
              </div>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1.5x xl:hidden">
              {count !== null && (
                <button
                  onClick={refreshNow}
                  aria-label={t('home.refreshFeed')}
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
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>

          <button
            onClick={() => setPaletteOpen(true)}
            className="flex h-10 min-w-0 flex-1 items-center gap-1.5x rounded-pill border border-ink/[0.08] bg-surface/70 px-2x text-body text-ink-muted shadow-sm transition-all hover:border-accent/30 hover:bg-surface-raised hover:text-ink hover:shadow-card"
          >
            <Search className="h-4 w-4 shrink-0 text-accent/70" aria-hidden />
            <span className="min-w-0 flex-1 whitespace-nowrap text-left">
              <span className="hidden 2xl:inline">{t('home.searchPlaceholder')}</span>
              <span className="2xl:hidden">{t('home.searchShort')}</span>
            </span>
          </button>

          <div className="hidden items-center gap-1.5x xl:flex">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

      </header>

      <HomePanel
        trains={trains}
        visible={visibleTrains}
        filters={filters}
        onFilters={setFilters}
        onRefresh={refreshNow}
        refreshing={refreshing}
        stale={stale}
        favorites={favorites}
        onOpenTrain={(n) => router.push(`/track/${n}`)}
        clock={istNow ? formatUpdated(istNow) : null}
        hideTrigger={!!(selected || selectedStation)}
        collapsed={panelCollapsed}
        onToggleCollapsed={togglePanel}
      />

      {error && (
        <div className="absolute inset-x-0 top-3x z-30 flex justify-center px-3x pt-12x">
          <button
            onClick={poll}
            className="glass-strong rounded-pill px-3x py-1.5x text-body font-semibold text-accent shadow-glow"
          >
            {t('home.feedError')}
          </button>
        </div>
      )}

      {(selected || selectedStation) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-center pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-auto sm:left-3x sm:top-1/2 sm:pb-0 md:left-[5rem] sm:w-[min(26rem,42vw)] sm:-translate-y-1/2 sm:justify-start sm:p-0 sm:pl-3x">
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
