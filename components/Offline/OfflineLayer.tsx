'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useT } from '@/lib/i18n/useT';

export function OfflineLayer() {
  const { t } = useT();
  const [online, setOnline] = useState(true);
  const [justBack, setJustBack] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const off = () => setOnline(false);
    const on = () => {
      setOnline(true);
      setJustBack(true);
      setTimeout(() => setJustBack(false), 2500);
    };
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    return () => {
      window.removeEventListener('offline', off);
      window.removeEventListener('online', on);
    };
  }, []);

  if (online && !justBack) return null;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-[80] flex justify-center px-3">
      <div className={`glass-strong flex items-center gap-2 rounded-full px-4 py-2 text-caption font-bold ${online ? '' : 'border-stamp'}`}>
        <WifiOff className="h-4 w-4" aria-hidden />
        {online ? t('common.backOnline') : t('offline.banner')}
      </div>
    </div>
  );
}
