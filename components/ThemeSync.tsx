'use client';

import { useTimeTheme } from '@/lib/useTimeTheme';

// Applies the saved light/dark choice on every page, not just the map.
export function ThemeSync() {
  useTimeTheme();
  return null;
}
