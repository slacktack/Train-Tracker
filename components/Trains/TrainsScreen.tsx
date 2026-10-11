'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowUpDown, Clock, History, RefreshCcw, Search, X } from 'lucide-react';
import { ApiError, getJSON, type BetweenResponse } from '@/lib/client-api';
import { cn } from '@/lib/cn';
import { durationToMin, formatAge, formatDay, hhmmToMin, isoDate, isoToDate, parseUpstreamTime } from '@/lib/format';
import { useStationIndex } from '@/lib/useStationIndex';
import { routeKey, useRecentRoutesStore } from '@/store/useRecentsExtras';
import { DateStrip } from '@/components/Search/DateStrip';
import { StationPicker, type PickedStation } from '@/components/Search/StationPicker';
import { Chip, EmptyState, ErrorState, GlassCard, PageHeader, PageShell, Segmented, Skeleton } from '@/components/ui/kit';
import { useT } from '@/lib/i18n/useT';
import { useStationName } from '@/lib/i18n/stationNames';
import { TrainResultCard } from './TrainResultCard';
import { SplitView } from './SplitView';
import { ComboList } from './ComboList';
import { anchorOf } from '@/lib/cities';
import { RoutePlan } from './RoutePlan';
import { PendingBookingBanner } from '@/components/Trips/PendingBookingBanner';
import { Plus } from 'lucide-react';
import { Columns2 } from 'lucide-react';
import type { AlternativesResponse } from '@/lib/combos-types';

const QUOTAS = ['GN', 'TQ', 'LD', 'SS'] as const;
type SortKey = 'departure' | 'duration' | 'fare';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const codeOk = (v: string | null) => !!v && /^~?[A-Za-z0-9]{1,6}$/.test(v);
const dateOk = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

function ResultSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-3" aria-label={label} role="status">
      {[0, 1, 2, 3].map((i) => (
        <GlassCard key={i} className="space-y-3 p-4">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-9 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-16 w-28" />
            <Skeleton className="h-16 w-28" />
            <Skeleton className="h-16 w-28" />
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

export function TrainsScreen() {
  const { t, lang } = useT();
  const local = useStationName();
  const [showDeparted, setShowDeparted] = useState(false);
  const router = useRouter();
  const sp = useSearchParams();
  const { search, ready } = useStationIndex();
  const pushRoute = useRecentRoutesStore((s) => s.push);
  const { routes, remove } = useRecentRoutesStore();

  const urlFrom = codeOk(sp.get('from')) ? sp.get('from')!.toUpperCase() : null;
  const urlTo = codeOk(sp.get('to')) ? sp.get('to')!.toUpperCase() : null;
  const urlDate = dateOk(sp.get('date')) ? sp.get('date')! : isoDate(0);
  const urlQuota = (QUOTAS as readonly string[]).includes(sp.get('quota') ?? '') ? sp.get('quota')! : 'GN';

  const urlFromName = sp.get('fromName');
  const urlToName = sp.get('toName');
  const urlVia = (sp.get('via') ?? '').toUpperCase().split(',').filter((c) => codeOk(c)).slice(0, 3);
  const [vias, setVias] = useState<Array<PickedStation | null>>(urlVia.map((c) => ({ code: c, name: c })));
  const [from, setFrom] = useState<PickedStation | null>(urlFrom ? { code: urlFrom, name: urlFrom } : null);
  const [to, setTo] = useState<PickedStation | null>(urlTo ? { code: urlTo, name: urlTo } : null);
  const [date, setDate] = useState(urlDate);
  const [quota, setQuota] = useState(urlQuota);
  const [formError, setFormError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('departure');
  const [clsFilter, setClsFilter] = useState<string | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [fromStn, setFromStn] = useState<string | null>(null);
  const [toStn, setToStn] = useState<string | null>(null);

  // Upgrade bare codes from the URL to full names once the local index loads.
  useEffect(() => {
    if (!ready) return;
    const upgrade = (p: PickedStation | null) => {
      if (!p || p.name !== p.code) return p;
      if (p.code.startsWith('~')) {
        const typed = p.code === urlFrom ? urlFromName : p.code === urlTo ? urlToName : null;
        const base = search(p.code.slice(1), 1)[0];
        return { code: p.code, name: `${typed ?? base?.name ?? p.code.slice(1)} (all stations)` };
      }
      const hit = search(p.code, 1)[0];
      return hit && hit.code === p.code ? { code: hit.code, name: hit.name } : p;
    };
    setFrom(upgrade);
    setTo(upgrade);
    setVias((cur) => cur.map(upgrade));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const active = urlFrom && urlTo ? { from: urlFrom, to: urlTo, via: urlVia, date: urlDate, quota: urlQuota } : null;
  const planned = !!active && active.via.length > 0;

  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['between', active?.from, active?.to, active?.date, active?.quota],
    queryFn: ({ signal }) => getJSON<BetweenResponse>(`/api/trains/between?from=${active!.from}&to=${active!.to}&date=${active!.date}&quota=${active!.quota}${urlFromName ? `&fromName=${encodeURIComponent(urlFromName)}` : ''}${urlToName ? `&toName=${encodeURIComponent(urlToName)}` : ''}`, signal),
    enabled: !!active && !planned,
    staleTime: 2 * 60_000,
    placeholderData: keepPreviousData,
  });

  const directCount = data?.trains.filter((x) => !x.departed).length ?? 0;
  const [wantConnect, setWantConnect] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [splitOpen, setSplitOpen] = useState(false);
  const togglePick = (n: string) => setPicked((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : cur.length < 2 ? [...cur, n] : cur));
  const compareProps = (n: string) => ({ selected: picked.includes(n), disabled: picked.length >= 2, onToggle: () => togglePick(n) });
  const autoConnect = !!active && !!data && directCount <= 2;
  const connect = useQuery({
    queryKey: ['connect', active?.from, active?.to, active?.date, active?.quota],
    queryFn: ({ signal }) => getJSON<AlternativesResponse>(`/api/trains/alternatives?from=${anchorOf(active!.from)}&to=${anchorOf(active!.to)}&date=${active!.date}&quota=${active!.quota}`, signal),
    enabled: !!active && (autoConnect || wantConnect),
    staleTime: 3 * 60_000,
    retry: 0,
  });

  const submit = (override?: { from: PickedStation; to: PickedStation }) => {
    const f = override?.from ?? from;
    const dest = override?.to ?? to;
    const middle = override ? [] : vias;
    if (!f || !dest) return setFormError(t('trains.pickBoth'));
    if (f.code === dest.code && middle.length === 0) return setFormError(t('trains.mustDiffer'));
    if (middle.some((v) => !v)) return setFormError(t('via.needAll'));
    const path = [f.code, ...middle.map((v) => v!.code), dest.code];
    if (path.some((c, i) => i > 0 && c === path[i - 1])) return setFormError(t('via.dup'));
    setFormError(null);
    pushRoute({ from: f, to: dest });
    const via = middle.length ? `&via=${middle.map((v) => v!.code).join(',')}` : '';
    const cityName = (p: PickedStation, key: string) => (p.code.startsWith('~') ? `&${key}=${encodeURIComponent(p.name.replace(/ \(all stations\)$| · .*$/, ''))}` : '');
    router.push(`/trains?from=${f.code}&to=${dest.code}${cityName(f, 'fromName')}${cityName(dest, 'toName')}${via}&date=${date}&quota=${quota}`);
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const stationsUsed = useMemo(() => {
    const count = (pick: (x: NonNullable<typeof data>['trains'][number]) => { code: string; name: string }) => {
      const m = new Map<string, { name: string; n: number }>();
      for (const x of data?.trains ?? []) {
        const st = pick(x);
        m.set(st.code, { name: st.name, n: (m.get(st.code)?.n ?? 0) + 1 });
      }
      return Array.from(m, ([code, v]) => ({ code, ...v })).sort((a, b) => b.n - a.n);
    };
    return { from: count((x) => x.from), to: count((x) => x.to) };
  }, [data]);

  const classes = useMemo(() => Array.from(new Set(data?.trains.flatMap((t) => t.classes.map((c) => c.cls)) ?? [])), [data]);

  const trains = useMemo(() => {
    let list = data?.trains ?? [];
    if (fromStn) list = list.filter((x) => x.from.code === fromStn);
    if (toStn) list = list.filter((x) => x.to.code === toStn);
    if (clsFilter) list = list.filter((t) => t.classes.some((c) => c.cls === clsFilter));
    if (availableOnly) {
      list = list.filter((t) =>
        t.classes.some((c) => (clsFilter ? c.cls === clsFilter : true) && (c.verdict === 'confirm' || /^(AVL|RAC)/i.test(c.status))),
      );
    }
    const minFare = (t: (typeof list)[number]) => Math.min(...t.classes.map((c) => c.fare ?? Infinity));
    return [...list].sort((a, b) =>
      sort === 'departure' ? hhmmToMin(a.departure) - hhmmToMin(b.departure) : sort === 'duration' ? durationToMin(a.duration) - durationToMin(b.duration) : minFare(a) - minFare(b),
    );
  }, [data, clsFilter, availableOnly, sort, fromStn, toStn]);

  const upcoming = useMemo(() => trains.filter((x) => !x.departed), [trains]);
  const gone = useMemo(() => trains.filter((x) => x.departed), [trains]);
  const weekday = WEEKDAYS[isoToDate(urlDate).getUTCDay()];
  const goDate = (iso: string) => {
    setDate(iso);
    router.push(`/trains?from=${urlFrom}&to=${urlTo}${urlVia.length ? `&via=${urlVia.join(',')}` : ''}&date=${iso}&quota=${urlQuota}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const nextDay = () => {
    const d = isoToDate(urlDate);
    d.setUTCDate(d.getUTCDate() + 1);
    goDate(d.toISOString().slice(0, 10));
  };

  return (
    <PageShell>
      <PageHeader title={t('trains.title')} subtitle={t('trains.subtitle')} />
      <PendingBookingBanner className="mb-4" />

      <GlassCard strong className="relative z-20 space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <StationPicker allowCity label={t('trains.from')} value={from} onChange={setFrom} placeholder={t('trains.leavingFrom')} />
          <button
            type="button"
            onClick={swap}
            aria-label={t('trains.swap')}
            className="mx-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink/[0.08] bg-surface-raised/80 text-accent transition-transform active:rotate-180 sm:mx-0 sm:mb-1"
          >
            <ArrowUpDown className="h-4 w-4 sm:rotate-90" aria-hidden />
          </button>
          <StationPicker allowCity label={t('trains.to')} value={to} onChange={setTo} placeholder={t('trains.goingTo')} />
        </div>
        {vias.length > 0 && (
          <div className="space-y-3 border-l-[3px] border-dashed border-ink/25 pl-3">
            {vias.map((v, i) => (
              <div key={i} className="flex items-end gap-2">
                <StationPicker label={t('via.label', { n: i + 1 })} value={v} onChange={(p) => setVias((cur) => cur.map((x, k) => (k === i ? p : x)))} placeholder={t('via.placeholder')} />
                <button
                  type="button"
                  onClick={() => setVias((cur) => cur.filter((_, k) => k !== i))}
                  aria-label={t('via.remove')}
                  className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink/25 text-ink-muted hover:text-ink"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
        <div>
          {vias.length < 3 && (
            <button type="button" onClick={() => setVias((cur) => [...cur, null])} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-dashed border-ink/40 px-3 text-caption font-bold hover:bg-ink/[0.05]">
              <Plus className="h-4 w-4" aria-hidden /> {t('via.add')}
            </button>
          )}
          {vias.length === 0 && <p className="mt-1.5 text-caption text-ink-muted">{t('via.hint')}</p>}
        </div>
        <DateStrip value={date} onChange={setDate} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Segmented label={t('common.quota')} value={quota} onChange={setQuota} options={QUOTAS.map((q) => ({ value: q, label: t(`trains.quota.${q}` as 'trains.quota.GN') }))} className="sm:w-auto" />
          <button
            onClick={() => submit()}
            className="cta-lamp flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-body font-bold"
          >
            <Search className="h-4 w-4" aria-hidden /> {t('trains.search')}
          </button>
        </div>
        {formError && (
          <p role="alert" className="text-caption font-medium text-status-heavyDelay">
            {formError}
          </p>
        )}
      </GlassCard>

      {!active && routes.length > 0 && (
        <section className="mt-5" aria-label={t('trains.recentRoutes')}>
          <p className="mb-2 flex items-center gap-1.5 text-caption font-semibold text-ink-muted">
            <History className="h-3.5 w-3.5" aria-hidden /> {t('trains.recentRoutes')}
          </p>
          <div className="flex flex-wrap gap-2">
            {routes.map((r) => (
              <span key={routeKey(r)} className="flex items-center">
                <Chip onClick={() => submit({ from: r.from, to: r.to })} className="pr-2">
                  {r.from.code} → {r.to.code}
                </Chip>
                <button onClick={() => remove(routeKey(r))} aria-label={t('common.remove')} className="-ml-1 flex h-6 w-6 items-center justify-center rounded-full text-ink-muted/60 hover:text-ink">
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        </section>
      )}

      {!active && routes.length === 0 && (
        <div className="mt-5">
          <EmptyState title={t('trains.whereTo')} hint={t('trains.whereToHint')} />
        </div>
      )}

      {active && planned && <RoutePlan stops={[anchorOf(active.from), ...active.via, anchorOf(active.to)]} date={active.date} quota={active.quota} />}

      {active && !planned && (
        <section className="mt-6" aria-live="polite">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-display text-subhead">
                {(data?.from.name ?? active.from)} → {(data?.to.name ?? active.to)}
              </p>
              <p className="flex items-center gap-1.5 text-caption text-ink-muted">
                <Clock className="h-3.5 w-3.5" aria-hidden /> {formatDay(active.date, lang)} · {t(`trains.quota.${active.quota}` as 'trains.quota.GN')}
                {data && ` · ${trains.length === 1 ? t('trains.count1') : t('trains.count', { n: trains.length })}`}
                {isFetching && !isLoading && <span className="live-dot ml-1 inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-label={t('common.refresh')} />}
              </p>
            </div>
            {data && data.trains.length > 0 && (
              <Segmented
                label={t('trains.sort.departure')}
                value={sort}
                onChange={setSort}
                options={[
                  { value: 'departure', label: t('trains.sort.departure') },
                  { value: 'duration', label: t('trains.sort.duration') },
                  { value: 'fare', label: t('trains.sort.fare') },
                ]}
              />
            )}
          </div>

          {data && (stationsUsed.from.length > 1 || stationsUsed.to.length > 1) && (
            <div className="mb-3 space-y-2" role="group" aria-label={t('city.stationsUsed')}>
              {([['from', stationsUsed.from, fromStn, setFromStn, t('city.boarding')], ['to', stationsUsed.to, toStn, setToStn, t('trains.to')]] as const).map(([key, list, cur, set, label]) =>
                list.length > 1 ? (
                  <div key={key} className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                    <span className="shrink-0 text-caption font-semibold text-ink-muted">{label}</span>
                    <Chip active={!cur} onClick={() => set(null)}>{t('city.allStations')}</Chip>
                    {list.map((st) => (
                      <Chip key={st.code} active={cur === st.code} onClick={() => set(cur === st.code ? null : st.code)}>
                        {local(st.code, st.name)} · {st.n}
                      </Chip>
                    ))}
                  </div>
                ) : null,
              )}
            </div>
          )}
          {data && classes.length > 0 && (
            <div className="mb-3 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1" role="group" aria-label={t('common.class')}>
              <Chip active={availableOnly} onClick={() => setAvailableOnly((v) => !v)}>
                {t('trains.availableOnly')}
              </Chip>
              <span className="h-4 w-px shrink-0 bg-ink/10" aria-hidden />
              <Chip active={!clsFilter} onClick={() => setClsFilter(null)}>
                {t('trains.allClasses')}
              </Chip>
              {classes.map((c) => (
                <Chip key={c} active={clsFilter === c} onClick={() => setClsFilter(clsFilter === c ? null : c)}>
                  {c}
                </Chip>
              ))}
            </div>
          )}

          {data && data.trains.length > 0 && (
            <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-muted" role="status">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                {data.fetchedAt ? t('trains.checkedAt', { age: formatAge(parseUpstreamTime(data.fetchedAt), lang) }) : t('trains.checkedUnknown')} · {t('trains.estimateNote')}
              </span>
              <button type="button" onClick={() => refetch()} disabled={isFetching} className="flex min-h-9 items-center gap-1 rounded-lg px-2 font-semibold text-ink hover:bg-ink/[0.05] disabled:opacity-50">
                <RefreshCcw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} aria-hidden /> {t('common.refresh')}
              </button>
            </p>
          )}
          {data && data.trains.length > 0 && (
            <details className="mb-3 rounded-lg border border-ink/10 px-3 py-2 text-caption text-ink-muted">
              <summary className="cursor-pointer font-semibold text-ink">{t('glossary.title')}</summary>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                {(['avl', 'wl', 'rac', 'cnf', 'chance', 'tq', 'chart'] as const).map((k) => (
                  <div key={k} className="contents">
                    <dt className="font-bold text-ink">{t(`glossary.${k}.term` as 'glossary.avl.term')}</dt>
                    <dd>{t(`glossary.${k}` as 'glossary.avl')}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
          {isLoading && <ResultSkeleton label={t('common.loading')} />}
          {error && !data && <ErrorState message={error instanceof ApiError ? error.message : t('common.somethingWrong')} provider={error instanceof ApiError ? error.provider : undefined} onRetry={() => refetch()} />}
          {data && trains.length === 0 && !(data.nearby?.length) && !autoConnect && (
            <EmptyState
              title={data.trains.length === 0 ? t('trains.none') : t('trains.noMatch')}
              hint={data.trains.length === 0 ? t('trains.noneHint') : t('trains.noMatchHint')}
              action={
                data.trains.length === 0 ? (
                  <button onClick={nextDay} className="cta-lamp mt-2 rounded-xl px-4 py-2 text-body font-bold">
                    {t('trains.nextDay')}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setClsFilter(null);
                      setAvailableOnly(false);
                    }}
                    className="cta-lamp mt-2 rounded-xl px-4 py-2 text-body font-bold"
                  >
                    {t('trains.clearFilters')}
                  </button>
                )
              }
            />
          )}
          <div className={cn('space-y-3.5 transition-opacity', isFetching && !isLoading && 'opacity-80')}>
            {upcoming.map((tr) => (
              <TrainResultCard key={tr.number} train={tr} date={active.date} quota={active.quota} weekday={weekday} compare={compareProps(tr.number)} onPickDate={goDate} />
            ))}
            {data && trains.length > 0 && upcoming.length === 0 && (
              <EmptyState title={t('trains.noneUpcoming')} hint={t('trains.noneUpcomingHint')} />
            )}
            {gone.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeparted((v) => !v)}
                  aria-expanded={showDeparted}
                  className="mb-3 flex w-full items-center justify-between rounded-lg border border-dashed border-ink/30 px-3.5 py-2.5 text-body font-semibold text-ink-muted transition-colors hover:text-ink"
                >
                  {t('trains.departedList', { n: gone.length })}
                  <span aria-hidden className={cn('transition-transform', showDeparted && 'rotate-180')}>⌄</span>
                </button>
                {showDeparted && (
                  <div className="space-y-3.5">
                    {gone.map((tr) => (
                      <TrainResultCard key={tr.number} train={tr} date={active.date} quota={active.quota} weekday={weekday} compare={compareProps(tr.number)} onPickDate={goDate} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {active && data && (
            <div className="mt-8 space-y-6" aria-label={t('trains.alt.title')}>
              {directCount === 0 && (
                <div>
                  <h2 className="text-subhead font-bold">{t('trains.noDirect')}</h2>
                  <p className="text-body text-ink-muted">{t('trains.noDirectHint')}</p>
                </div>
              )}

              {data.nearby && data.nearby.length > 0 && (
                <section aria-label={t('trains.nearby')}>
                  <h2 className="mb-3 text-body font-bold">{t('trains.nearby')}</h2>
                  <div className="space-y-3.5">
                    {data.nearby.map((n) => (
                      <TrainResultCard
                        key={`${n.train.number}-${n.fromCode}-${n.toCode}`}
                        train={n.train}
                        date={active.date}
                        quota={active.quota}
                        weekday={weekday}
                        compare={compareProps(n.train.number)}
                        fromNote={n.fromCode !== active.from ? t('trains.kmAway', { km: n.fromKm, station: local(active.from, data.from.name) }) : undefined}
                        toNote={n.toCode !== active.to ? t('trains.kmAway', { km: n.toKm, station: local(active.to, data.to.name) }) : undefined}
                      />
                    ))}
                  </div>
                </section>
              )}

              <section aria-label={t('trains.connect')}>
                <h2 className="mb-3 text-body font-bold">{t('trains.connect')}</h2>
                {!autoConnect && !wantConnect && (
                  <button type="button" onClick={() => setWantConnect(true)} className="cta-lamp flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-body font-bold sm:w-auto">
                    {t('trains.connectFind')}
                  </button>
                )}
                {connect.isFetching && !connect.data && (
                  <div role="status" aria-live="polite" className="space-y-3">
                    <p className="text-caption font-semibold text-ink-muted">{t('trains.connecting')}</p>
                    {[0, 1].map((i) => (
                      <GlassCard key={i} className="space-y-3 p-4">
                        <Skeleton className="h-5 w-1/2" />
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                      </GlassCard>
                    ))}
                  </div>
                )}
                {connect.error && <ErrorState message={connect.error instanceof ApiError ? connect.error.message : t('common.somethingWrong')} onRetry={() => connect.refetch()} />}
                {connect.data && connect.data.combos.length === 0 && <EmptyState title={t('trains.connectNone')} hint={t('trains.connectNoneHint')} />}
                {connect.data && connect.data.combos.length > 0 && <ComboList combos={connect.data.combos} quota={active.quota} />}
              </section>
            </div>
          )}
        </section>
      )}

      {picked.length > 0 && data && (
        <div className="fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-ink bg-surface-elevated px-3 py-2 shadow-glow md:bottom-6">
          <span className="text-caption font-semibold">{picked.length < 2 ? t('split.pickTwo') : t('split.compareBar', { n: 2 })}</span>
          <span className="flex gap-1.5">
            <button type="button" onClick={() => setPicked([])} className="min-h-10 rounded-lg border border-ink/30 px-3 text-caption font-semibold">{t('common.clear')}</button>
            <button type="button" disabled={picked.length < 2} onClick={() => setSplitOpen(true)} className="cta-lamp flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-caption font-bold disabled:opacity-40">
              <Columns2 className="h-4 w-4" aria-hidden /> {t('split.compare')}
            </button>
          </span>
        </div>
      )}
      {splitOpen && picked.length === 2 && data && (() => {
        const all = [...data.trains, ...(data.nearby ?? []).map((n) => n.train)];
        const two = picked.map((n) => all.find((x) => x.number === n)).filter(Boolean) as typeof data.trains;
        if (two.length < 2) return null;
        return (
          <SplitView
            quota={urlQuota}
            onClose={() => setSplitOpen(false)}
            panels={two.map((x) => ({ train: x, depIso: urlDate, depTime: x.departure, arrIso: urlDate, arrTime: x.arrival }))}
          />
        );
      })()}
    </PageShell>
  );
}
