'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, History, ShieldCheck, X } from 'lucide-react';
import { useRecentPnrStore } from '@/store/useRecentsExtras';
import { GlassCard, PageHeader, PageShell, SectionLabel } from '@/components/ui/kit';
import { useT } from '@/lib/i18n/useT';

export function PnrLookup() {
  const { t } = useT();
  const router = useRouter();
  const { pnrs, remove } = useRecentPnrStore();
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const valid = /^\d{10}$/.test(value);

  const go = (pnr: string) => router.push(`/pnr/${pnr}`);

  return (
    <PageShell>
      <PageHeader title={t('pnr.title')} subtitle={t('pnr.subtitle')} />
      <GlassCard strong className="p-4 sm:p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (valid) go(value);
          }}
          className="space-y-3"
        >
          <label htmlFor="pnr" className="block text-caption font-semibold text-ink-muted">
            {t('pnr.number')}
          </label>
          <input
            id="pnr"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            maxLength={10}
            value={value}
            placeholder={t('pnr.placeholder')}
            aria-invalid={touched && !valid}
            aria-describedby="pnr-hint"
            onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className="h-14 w-full rounded-2xl border border-ink/[0.08] bg-surface-raised/70 px-4 font-mono text-[1.5rem] font-semibold tracking-[0.18em] outline-none transition-all placeholder:text-[1rem] placeholder:font-normal placeholder:tracking-normal placeholder:text-ink-muted/60 focus:border-accent/50 focus:shadow-glow"
          />
          <p id="pnr-hint" className={touched && !valid ? 'text-caption font-medium text-status-heavyDelay' : 'text-caption text-ink-muted'}>
            {touched && !valid ? t('pnr.invalid') : t('pnr.digits', { n: value.length })}
          </p>
          <button
            type="submit"
            disabled={value.length === 0}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl  text-body font-semibold   transition-all active:scale-[0.98] disabled:opacity-50 cta-lamp"
          >
            {t('pnr.check')} <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </form>
        <p className="mt-4 flex items-start gap-2 text-caption text-ink-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-status-onTime" aria-hidden />
          {t('pnr.privacy')}
        </p>
      </GlassCard>

      {pnrs.length > 0 && (
        <section className="mt-6" aria-label={t('pnr.recent')}>
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" aria-hidden /> {t('pnr.recent')}
          </SectionLabel>
          <ul className="grid gap-2 sm:grid-cols-2">
            {pnrs.map((p) => (
              <li key={p.pnr} className="glass flex items-center gap-2 rounded-2xl p-1.5">
                <button onClick={() => go(p.pnr)} className="min-w-0 flex-1 rounded-xl px-3 py-2 text-left transition-colors hover:bg-ink/[0.04]">
                  <p className="font-mono text-body font-semibold tracking-wider">{p.pnr}</p>
                  {p.trainName && <p className="break-words text-caption text-ink-muted">{p.trainName}</p>}
                </button>
                <button onClick={() => remove(p.pnr)} aria-label={`${t('common.remove')} ${p.pnr}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted/60 hover:text-ink">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  );
}
