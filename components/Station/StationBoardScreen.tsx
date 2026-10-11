'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Ban, CornerUpRight, RefreshCcw, Search, Star, TrainFront, X } from 'lucide-react';
import type { BoardRow } from '@/lib/sources/wimt';
import { ApiError, getJSON, type BoardResponse } from '@/lib/client-api';
import { cn } from '@/lib/cn';
import { delayTone, formatDelayMin, hhmmToMin, isoDate, toIsoDate } from '@/lib/format';
import { trainTypeColor } from '@/lib/train-type';
import { StationCompanion, StationFacts } from './StationCompanion';
import { useStationStore } from '@/store/useRecentsExtras';
import { useRouter } from 'next/navigation';
import { StationPicker } from '@/components/Search/StationPicker';
import { TrainSeatsSheet } from '@/components/Trains/TrainSeatsSheet';
import { Chip, EmptyState, ErrorState, GlassCard, PageShell, Segmented, Skeleton } from '@/components/ui/kit';
import { useT } from '@/lib/i18n/useT';
import { useGoBack } from '@/lib/useGoBack';
import { useStationName } from '@/lib/i18n/stationNames';

type Tab = 'dep' | 'arr';
type Kind = 'all' | 'express' | 'local';
const LOCAL_TYPES = new Set(['EMU', 'MEMU', 'SUB', 'DMU', 'MMTS']);

const TONE = {
  ok: 'bg-status-onTime/12 text-status-onTime',
  warn: 'bg-status-minorDelay/12 text-status-minorDelay',
  bad: 'bg-status-heavyDelay/12 text-status-heavyDelay',
  none: 'bg-ink/[0.06] text-ink-muted',
} as const;

function istNowMin(): number {
  const d = new Date(Date.now() + 5.5 * 3600_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

// Minutes from now, wrapping midnight; late trains may be up to 6h "in the past".
function relMin(hhmm: string | null, now: number): number {
  const m = hhmmToMin(hhmm);
  if (m === Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
  return ((m - now + 1440 + 360) % 1440) - 360;
}

function BoardItem({ row, tab, onOpen }: { row: BoardRow; tab: Tab; onOpen: () => void }) {
  const { t, lang } = useT();
  const local = useStationName();
  const sched = tab === 'dep' ? row.schDep : row.schArr;
  const expected = tab === 'dep' ? row.actDep : row.actArr;
  const delay = tab === 'dep' ? (row.delayDepMin ?? row.delayArrMin) : (row.delayArrMin ?? row.delayDepMin);
  const tone = row.cancelled ? 'bad' : delayTone(delay);
  const late = (delay ?? 0) >= 5;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-all active:scale-[0.99] hover:shadow-premium"
      >
        <div className="w-14 shrink-0 text-center">
          <p className={cn('font-display text-[1.25rem] font-semibold leading-none', late && 'text-ink-muted line-through decoration-1')}>{sched ?? '—'}</p>
          {late && expected && <p className="mt-0.5 font-display text-caption font-semibold text-status-minorDelay">{expected}</p>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: trainTypeColor(row.trainType) }} aria-hidden />
            <span className="font-mono text-caption font-bold text-ink-muted">{row.trainNo}</span>
            <span className="break-words text-body font-semibold leading-snug">{row.trainName}</span>
          </p>
          <p className="mt-0.5 text-caption text-ink-muted">
            {tab === 'dep' ? t('station.toDest', { x: local(row.to, row.to) }) : t('station.fromSrc', { x: local(row.from, row.from) })}
            {row.atStation && ` · ${t('station.atNow')}`}
            {row.diverted && ` · ${t('common.diverted')}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {row.platform && (
            <span className="rounded-lg bg-accent/12 px-2 py-0.5 text-caption font-bold text-accent" aria-label={`${t('common.platform')} ${row.platform}`}>
              {t('common.pf')} {row.platform}
            </span>
          )}
          <span className={cn('flex items-center gap-1 rounded-lg px-2 py-0.5 text-caption font-semibold', TONE[tone])}>
            {row.cancelled ? (
              <>
                <Ban className="h-3 w-3" aria-hidden /> {t('common.cancelled')}
              </>
            ) : row.diverted ? (
              <>
                <CornerUpRight className="h-3 w-3" aria-hidden /> {t('common.diverted')}
              </>
            ) : delay == null ? (
              t('common.scheduled')
            ) : delay <= 0 ? (
              t('common.onTime')
            ) : (
              `+${formatDelayMin(delay, lang)}`
            )}
          </span>
        </div>
      </button>
    </li>
  );
}

export function StationBoardScreen({ code, train }: { code: string; train?: string }) {
  const { t } = useT();
  const goBack = useGoBack('/station');
  const local = useStationName();
  const [tab, setTab] = useState<Tab>('dep');
  const [hrs, setHrs] = useState(4);
  const [kind, setKind] = useState<Kind>('all');
  const [query, setQuery] = useState('');
  const [openRow, setOpenRow] = useState<BoardRow | null>(null);
  const router = useRouter();
  const { has, toggle, pushRecent } = useStationStore();

  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['board', code, hrs],
    queryFn: async ({ signal }) => {
      const res = await getJSON<BoardResponse>(`/api/board/${code}?hrs=${hrs}`, signal);
      pushRecent({ code: res.station.code, name: res.station.name });
      return res;
    },
    refetchInterval: 45_000,
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  });

  const rows = useMemo(() => {
    const now = istNowMin();
    const list = (data?.rows ?? []).filter((r) => (tab === 'dep' ? !r.isTerminus && r.schDep : !r.isSource && r.schArr));
    const q = query.trim().toLowerCase();
    const matches = q ? list.filter((r) => `${r.trainNo} ${r.trainName} ${r.to} ${r.from}`.toLowerCase().includes(q)) : list;
    const byKind = matches.filter((r) => (kind === 'all' ? true : kind === 'local' ? LOCAL_TYPES.has(r.trainType) : !LOCAL_TYPES.has(r.trainType)));
    return byKind.sort((a, b) => relMin(tab === 'dep' ? a.schDep : a.schArr, now) - relMin(tab === 'dep' ? b.schDep : b.schArr, now));
  }, [data, tab, kind, query]);

  const station = data?.station;
  const saved = has(code);
  const updated = data?.modifiedAt ? new Date(data.modifiedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }) : null;

  return (
    <PageShell>
      <div className="flex items-center justify-between pb-3 pt-3 sm:pt-6">
        <button type="button" onClick={goBack} className="flex min-h-10 items-center gap-1.5 text-body font-medium text-ink-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {t('common.back')}
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => station && toggle({ code: station.code, name: station.name })}
            aria-label={saved ? t('station.unsaveStation') : t('station.saveStation')}
            aria-pressed={saved}
            className="glass flex h-10 w-10 items-center justify-center rounded-full"
          >
            <Star className={cn('h-4 w-4', saved && 'fill-amber-400 text-amber-400')} aria-hidden />
          </button>
          <button onClick={() => refetch()} aria-label={t('common.refresh')} className="glass flex h-10 w-10 items-center justify-center rounded-full">
            <RefreshCcw className={cn('h-4 w-4', isFetching && 'animate-spin')} aria-hidden />
          </button>
        </div>
      </div>

      <div className="mb-4">
        <p className="font-mono text-caption font-bold text-accent">{code}</p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-8 tracking-tight">{station ? local(station.code, station.name) : isLoading ? '…' : code}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-caption text-ink-muted">
          <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-status-onTime" aria-hidden />
          {t('station.liveBoard')}{updated ? ` · ${t('station.updated', { time: updated })}` : ''} · {t('station.refreshes')}
        </p>
        <StationFacts code={code} />
      </div>

      {train && <StationCompanion code={code} stationName={station?.name ?? code} train={train} />}

      <div className="relative z-20 mb-3 grid gap-2 sm:grid-cols-2">
        <label className="flex h-12 items-center gap-2 rounded-2xl border border-ink/20 bg-surface-elevated/70 px-3 focus-within:border-ink/60">
          <Search className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('station.filter')}
            aria-label={t('station.filter')}
            className="min-w-0 flex-1 bg-transparent text-body font-medium outline-none placeholder:text-ink-muted/70"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label={t('common.clear')} className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:text-ink">
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </label>
        <StationPicker label="" value={null} onChange={(st) => st && router.push(`/station/${st.code}`)} placeholder={t('station.switch')} />
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          label={t('station.liveBoard')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'dep', label: t('station.departures') },
            { value: 'arr', label: t('station.arrivals') },
          ]}
          className="sm:w-64"
        />
        <Segmented
          label={t('station.liveBoard')}
          value={String(hrs) as '2' | '4' | '8'}
          onChange={(v) => setHrs(Number(v))}
          options={[
            { value: '2', label: t('station.next2') },
            { value: '4', label: t('station.next4') },
            { value: '8', label: t('station.next8') },
          ]}
          className="sm:w-60"
        />
      </div>
      <div className="mb-4 flex gap-2" role="group" aria-label="Train kind">
        {(['all', 'express', 'local'] as const).map((k) => (
          <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
            {k === 'all' ? t('station.all') : k === 'express' ? t('station.express') : t('station.local')}
          </Chip>
        ))}
      </div>

      {isLoading && (
        <div role="status" aria-label={t('common.loading')} className="space-y-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <GlassCard key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="h-10 w-14" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-8 w-16" />
            </GlassCard>
          ))}
        </div>
      )}
      {error && !data && (
        error instanceof ApiError && error.status === 404 ? (
          <EmptyState title={t('station.unknown')} hint={t('station.unknownHint', { code })} action={<Link href="/station" className="mt-2 rounded-pill  px-4 py-2 text-body font-semibold cta-lamp">{t('station.searchStations')}</Link>} />
        ) : (
          <ErrorState message={error instanceof ApiError ? error.message : t('common.somethingWrong')} provider={error instanceof ApiError ? error.provider : undefined} onRetry={() => refetch()} />
        )
      )}
      {data && rows.length === 0 && (
        <EmptyState
          title={query ? t('station.noFilterMatch', { q: query }) : tab === 'dep' ? t('station.noDep') : t('station.noArr')}
          hint={t('station.tryLonger')}
          action={
            hrs < 8 ? (
              <button onClick={() => setHrs(8)} className="mt-2 rounded-pill  px-4 py-2 text-body font-semibold   active:scale-95 cta-lamp">
                {t('station.show8')}
              </button>
            ) : undefined
          }
        />
      )}
      <ul className={cn('space-y-2 transition-opacity', isFetching && !isLoading && 'opacity-90')} aria-live="polite">
        {rows.map((r) => (
          <BoardItem key={`${r.trainNo}-${r.startDate}-${tab}`} row={r} tab={tab} onOpen={() => setOpenRow(r)} />
        ))}
      </ul>
      {data && rows.length > 0 && (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-caption text-ink-muted">
          <TrainFront className="h-3.5 w-3.5" aria-hidden /> {t('station.countLine', { n: rows.length, h: data.hrs })}
        </p>
      )}
      {openRow && station && (
        <TrainSeatsSheet
          onClose={() => setOpenRow(null)}
          train={{
            number: openRow.trainNo,
            name: openRow.trainName,
            // departures: book from here to the train's last stop; arrivals: book from where it began to here
            from: tab === 'arr' ? { code: openRow.from, name: openRow.from } : { code: station.code, name: station.name },
            defaultTo: tab === 'arr' ? station.code : openRow.to,
            date: tab === 'arr' ? (toIsoDate(openRow.startDate) ?? isoDate(0)) : (openRow.schDepIso ?? '').slice(0, 10) || isoDate(0),
            cancelled: openRow.cancelled,
          }}
        />
      )}
    </PageShell>
  );
}
