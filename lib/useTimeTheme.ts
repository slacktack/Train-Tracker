'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { themeForIST, TimeTheme } from '@/lib/theme';

const THEME_RECHECK_MS = 60_000;
const STORAGE_KEY = 'train-tracker:theme';

export type ThemePreference = TimeTheme | 'auto';

interface ThemeState {
  preference: ThemePreference;
  theme: TimeTheme;
}

// Single source of truth shared by every useTimeTheme() consumer. The earlier
// per-component useState made ThemeToggle and the page drift apart: one hook
// instance updated, the other kept its stale preference until its own 60s tick.
let state: ThemeState | null = null;
const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'auto';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

function initState(): ThemeState {
  const preference = readPreference();
  let theme: TimeTheme;
  if (preference !== 'auto') {
    theme = preference;
  } else if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    theme = 'dark';
  } else {
    theme = themeForIST();
  }
  return { preference, theme };
}

function getSnapshot(): ThemeState {
  if (!state) state = initState();
  return state;
}

function getServerSnapshot(): ThemeState {
  return { preference: 'auto', theme: themeForIST() };
}

function apply(next: ThemeState) {
  state = next;
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', next.theme === 'dark');
  }
  listeners.forEach((listener) => listener());}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Auto mode re-evaluates on the clock; a manual override is read from storage.
if (typeof window !== 'undefined') {
  window.setInterval(() => {
    const preference = readPreference();
    apply({ preference, theme: preference === 'auto' ? themeForIST() : preference });
  }, THEME_RECHECK_MS);
}

export function useTimeTheme(): {
  theme: TimeTheme;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
} {
  const { theme, preference } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setPreference = useCallback((p: ThemePreference) => {
    try {
      if (p === 'auto') window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, p);
    } catch {
      // storage unavailable — in-memory override still applies this session
    }
    apply({ preference: p, theme: p === 'auto' ? themeForIST() : p });
  }, []);

  return { theme, preference, setPreference };
}

export { themeForIST, type TimeTheme };
