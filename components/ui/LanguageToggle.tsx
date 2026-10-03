'use client';

import { Languages } from 'lucide-react';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/cn';

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang, t } = useT();
  return (
    <div role="radiogroup" aria-label={t('language.label')} className={cn('glass flex items-center gap-0.5 rounded-pill p-0.5', className)}>
      <Languages className="ml-2 mr-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
      {(['en', 'hi'] as const).map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={lang === l}
          onClick={() => setLang(l)}
          lang={l}
          className={cn(
            'h-8 rounded-pill px-2.5 text-caption font-semibold transition-colors',
            lang === l ? 'pill-on' : 'text-ink-muted hover:text-ink',
          )}
        >
          {l === 'en' ? 'EN' : 'हिं'}
        </button>
      ))}
    </div>
  );
}
