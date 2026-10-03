'use client';

import { useRouter } from 'next/navigation';
import { Building2, History, Star } from 'lucide-react';
import { useStationStore } from '@/store/useRecentsExtras';
import { StationPicker } from '@/components/Search/StationPicker';
import { Chip, GlassCard, PageHeader, PageShell, SectionLabel } from '@/components/ui/kit';
import { useT } from '@/lib/i18n/useT';
import { useStationName } from '@/lib/i18n/stationNames';

const POPULAR = [
  ['NDLS', 'New Delhi'],
  ['CSMT', 'Mumbai CSMT'],
  ['HWH', 'Howrah'],
  ['MAS', 'Chennai Central'],
  ['SBC', 'Bengaluru City'],
  ['PUNE', 'Pune'],
  ['ADI', 'Ahmedabad'],
  ['LKO', 'Lucknow'],
  ['JP', 'Jaipur'],
  ['BPL', 'Bhopal'],
  ['PNBE', 'Patna'],
  ['SC', 'Secunderabad'],
] as const;

export function StationHome() {
  const { t } = useT();
  const local = useStationName();
  const router = useRouter();
  const { stations, recents } = useStationStore();
  const open = (code: string) => router.push(`/station/${code}`);

  return (
    <PageShell>
      <PageHeader title={t('station.title')} subtitle={t('station.subtitle')} />
      <GlassCard strong className="relative z-20 p-4 sm:p-5">
        <StationPicker label={t('station.find')} value={null} onChange={(s) => s && open(s.code)} placeholder={t('station.findPlaceholder')} />
      </GlassCard>

      {stations.length > 0 && (
        <section className="mt-6" aria-label={t('station.saved')}>
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 fill-lamp text-ink" aria-hidden /> {t('station.saved')}
          </SectionLabel>
          <div className="flex flex-wrap gap-2">
            {stations.map((s) => (
              <Chip key={s.code} tone="accent" onClick={() => open(s.code)} className="px-3 py-1.5">
                {local(s.code, s.name)} · {s.code}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {recents.length > 0 && (
        <section className="mt-6" aria-label={t('common.recent')}>
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" aria-hidden /> {t('common.recent')}
          </SectionLabel>
          <div className="flex flex-wrap gap-2">
            {recents.map((s) => (
              <Chip key={s.code} onClick={() => open(s.code)} className="px-3 py-1.5">
                {s.name} · {s.code}
              </Chip>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6" aria-label={t('common.popular')}>
        <SectionLabel className="mb-2 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" aria-hidden /> {t('common.popular')}
        </SectionLabel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {POPULAR.map(([code, name]) => (
            <button key={code} onClick={() => open(code)} className="glass rounded-2xl p-3 text-left transition-all active:scale-[0.98] hover:shadow-premium">
              <p className="font-mono text-caption font-bold text-accent">{code}</p>
              <p className="break-words text-body font-semibold">{local(code, name)}</p>
            </button>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
