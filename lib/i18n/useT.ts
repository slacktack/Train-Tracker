'use client';

import { useCallback } from 'react';
import { en, type I18nKey } from './en';
import { hi } from './hi';
import { useLang, type Lang } from './LangProvider';

export type Vars = Record<string, string | number>;

export function translate(lang: Lang, key: I18nKey, vars?: Vars): string {
  const raw = (lang === 'hi' ? hi[key] : en[key]) ?? en[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : raw;
}

export function useT() {
  const { lang, setLang } = useLang();
  const t = useCallback((key: I18nKey, vars?: Vars) => translate(lang, key, vars), [lang]);
  return { t, lang, setLang };
}
