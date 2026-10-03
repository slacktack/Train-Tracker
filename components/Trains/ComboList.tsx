'use client';

import { useMemo, useState } from 'react';
import type { Combo } from '@/lib/combos-types';
import { applyFilters, comboFare, DEFAULT_COMBO_FILTERS, sortCombos, type ComboFilters, type ComboSort } from '@/lib/combo-sort';
import { useT } from '@/lib/i18n/useT';
import { Chip, EmptyState, Segmented } from '@/components/ui/kit';
import { ComboCard } from './ComboCard';

// The sort and filter toggles plus the itineraries they apply to, shared by suggested and chosen routes.
export function ComboList({ combos, quota }: { combos: Combo[]; quota: string }) {
  const { t } = useT();
  const [sort, setSort] = useState<ComboSort>('best');
  const [filters, setFilters] = useState<ComboFilters>(DEFAULT_COMBO_FILTERS);
  const shown = useMemo(() => sortCombos(applyFilters(combos, filters), sort, filters.likelySeats), [combos, filters, sort]);
  if (combos.length === 0) return null;

  return (
    <div>
      <div className="mb-3 space-y-2.5">
        <Segmented
          label={t('combo.sort')}
          value={sort}
          onChange={setSort}
          className="overflow-x-auto no-scrollbar"
          options={(['best', 'fastest', 'cheapest', 'earliest', 'safest'] as const).map((k) => ({ value: k, label: t(`combo.sort.${k}` as 'combo.sort.best') }))}
        />
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('trains.connect')}>
          <Chip active={filters.likelySeats} onClick={() => setFilters((f) => ({ ...f, likelySeats: !f.likelySeats }))}>{t('combo.f.seats')}</Chip>
          <Chip active={filters.noTight} onClick={() => setFilters((f) => ({ ...f, noTight: !f.noTight }))}>{t('combo.f.noTight')}</Chip>
          <Chip active={filters.shortWait} onClick={() => setFilters((f) => ({ ...f, shortWait: !f.shortWait }))}>{t('combo.f.short')}</Chip>
          <span className="ml-auto text-caption text-ink-muted">{t('combo.shown', { n: shown.length, total: combos.length })}</span>
        </div>
        {sort === 'cheapest' && <p className="text-caption text-ink-muted">{t('combo.cheapNote')}</p>}
      </div>
      {shown.length === 0 && <EmptyState title={t('combo.noMatch')} hint={t('combo.noMatchHint')} />}
      <div className="space-y-3.5">
        {shown.map((c) => (
          <ComboCard key={c.id} combo={c} quota={quota} fare={comboFare(c, filters.likelySeats)} />
        ))}
      </div>
    </div>
  );
}
