'use client';

import { motion, useAnimation, PanInfo } from 'framer-motion';
import { useEffect } from 'react';
import { useTrackingStore } from '@/store/useTrackingStore';
import { resolveSnapState, SNAP_HEIGHTS } from './snapPhysics';
import { cn } from '@/lib/cn';

interface BottomSheetProps {
  peek: React.ReactNode;
  half: React.ReactNode;
}

export function BottomSheet({ peek, half }: BottomSheetProps) {
  const { sheetState, setSheetState } = useTrackingStore();
  const controls = useAnimation();
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  // Sheet is full viewport height; snaps translate it down. Clamp the drag so it
  // can never rise above the 'half' position (half screen is the maximum).
  const topLimit = (1 - SNAP_HEIGHTS.half) * viewportHeight;
  const bottomLimit = (1 - SNAP_HEIGHTS.peek) * viewportHeight;

  useEffect(() => {
    controls.start({ y: `${(1 - SNAP_HEIGHTS[sheetState]) * 100}%` });
  }, [sheetState, controls]);

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const currentHeightFraction = 1 - info.point.y / viewportHeight;
    const next = resolveSnapState(currentHeightFraction, -info.velocity.y);
    setSheetState(next);
    // Always re-animate: if next === sheetState the store set is a no-op and
    // without this the sheet would stay wherever the elastic drag left it.
    controls.start({ y: `${(1 - SNAP_HEIGHTS[next]) * 100}%` });
  }

  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: topLimit, bottom: bottomLimit }}
      dragElastic={0.15}
      onDragEnd={handleDragEnd}
      animate={controls}
      initial={{ y: `${(1 - SNAP_HEIGHTS.peek) * 100}%` }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className={cn(
        'fixed bottom-0 left-0 right-0 z-20 rounded-t-sheet border-t border-ink/10',
        'bg-surface-raised/80 shadow-glass backdrop-blur-2xl backdrop-saturate-150',
        'flex flex-col overflow-hidden'
      )}
      style={{ height: '100vh' }}
    >
      <div className="mx-auto mt-1x h-1 w-10 shrink-0 rounded-pill bg-ink-muted/40" />
      <div className="overflow-y-auto px-3x pb-[calc(env(safe-area-inset-bottom)+24px)] pt-2x">
        {peek}
        {sheetState === 'half' && half}
      </div>
    </motion.div>
  );
}
