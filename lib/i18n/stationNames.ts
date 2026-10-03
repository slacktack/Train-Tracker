'use client';

import { useEffect, useState } from 'react';
import { useLang } from './LangProvider';

let cache: Record<string, string> | null = null;
let pending: Promise<Record<string, string>> | null = null;

function load(): Promise<Record<string, string>> {
  pending ??= import('@/data/station-names-hi.json').then((m) => {
    cache = m.default as Record<string, string>;
    return cache;
  });
  return pending;
}

/** Returns a resolver: Hindi station name when the language is Hindi and known, otherwise the given English name. */
export function useStationName(): (code: string | undefined, fallback: string) => string {
  const { lang } = useLang();
  const [, bump] = useState(0);
  useEffect(() => {
    if (lang !== 'hi' || cache) return;
    let alive = true;
    load().then(() => alive && bump((n) => n + 1));
    return () => {
      alive = false;
    };
  }, [lang]);
  return (code, fallback) => (lang === 'hi' && code && cache?.[code.toUpperCase()]) || fallback;
}
