'use client';

import { useEffect, useState } from 'react';
import { Star, X } from 'lucide-react';
import { useTrainPhoto } from '@/hooks/useTrainPhoto';
import { useT } from '@/lib/i18n/useT';
import { trainTypeColor, trainTypeLabel } from '@/lib/train-type';
import { cn } from '@/lib/cn';
import { TrainArt } from './TrainArt';

interface TrainHeroProps {
  number: string;
  name: string;
  nameUnicode?: string;
  type: string;
  speedKmh?: number | null;
  showSpeed?: boolean;
  isFav: boolean;
  onFav: () => void;
  onClose?: () => void;
  className?: string;
}

export function TrainHero({ number, name, nameUnicode, type, speedKmh, showSpeed, isFav, onFav, onClose, className }: TrainHeroProps) {
  const { t, lang } = useT();
  const color = trainTypeColor(type);
  const { data: photo, isLoading } = useTrainPhoto(number, type);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [photo?.src]);
  const usePhoto = !!photo && !failed;

  return (
    <div className={cn('relative shrink-0 overflow-hidden', className)}>
      <div className="relative h-32 w-full bg-ink/10 sm:h-48">
        {usePhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.src}
            alt={`${name} ${number}`}
            className={cn('h-full w-full object-cover transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0')}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        ) : null}
        {(!usePhoto || !loaded) && <TrainArt color={color} className={cn('absolute inset-0 h-full w-full', usePhoto && !loaded && !isLoading && 'opacity-60')} />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/35" aria-hidden />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-caption font-bold text-white backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
            {trainTypeLabel(type, lang)}
          </span>
          <span className="flex items-center gap-1.5">
            <button
              onClick={onFav}
              aria-pressed={isFav}
              aria-label={isFav ? t('card.removeFav') : t('card.addFav')}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-transform active:scale-90"
            >
              <Star className={cn('h-5 w-5', isFav && 'fill-lamp text-lamp')} aria-hidden />
            </button>
            {onClose && (
              <button onClick={onClose} aria-label={t('common.close')} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-transform active:scale-90">
                <X className="h-5 w-5" aria-hidden />
              </button>
            )}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3.5">
          <div className="min-w-0">
            <p className="led text-[1.35rem] text-[#ffb43a]" style={{ textShadow: '0 0 8px rgb(255 160 40 / .5)' }}>
              {number}
            </p>
            <h2 className="mt-1 break-words text-[1.2rem] font-bold leading-tight text-white">{name}</h2>
            {nameUnicode && <p className="break-words text-caption text-white/75">{nameUnicode}</p>}
          </div>
          {showSpeed && (
            <div className="shrink-0 text-right">
              <p className="led text-[2.4rem] leading-none text-[#ffb43a]" style={{ textShadow: '0 0 10px rgb(255 160 40 / .55)' }}>
                {speedKmh ?? 0}
              </p>
              <p className="text-[0.6875rem] font-semibold text-white/70">{t('common.kmh')}</p>
            </div>
          )}
        </div>
      </div>
      {usePhoto && (
        <p className="bg-surface-elevated/80 px-3.5 py-1.5 text-[0.6875rem] leading-snug text-ink-muted">
          {photo.exact ? t('hero.exactPhoto') : t('hero.typePhoto')}. {t('hero.credit', { name: photo.credit.slice(0, 48), license: photo.license })}
        </p>
      )}
    </div>
  );
}
