'use client';

import { motion, useAnimation, PanInfo } from 'framer-motion';
import { useEffect } from 'react';
import { useTrackingStore } from '@/store/useTrackingStore';
import { resolveSnapState, SNAP_HEIGHTS } from './snapPhysics';
import { cn } from '@/lib/cn';

interface BottomSheetProps {
  peek: React.ReactNode;
  half: React.ReactNode;
  full: React.ReactNode;
}

export function BottomSheet({ peek, half, full }: BottomSheetProps) {
  const { sheetState, setSheetState } = useTrackingStore();
  const controls = useAnimation();

  useEffect(() => {
    controls.start({ y: `${(1 - SNAP_HEIGHTS[sheetState]) * 100}%` });
  }, [sheetState, controls]);

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const viewportHeight = window.innerHeight;
    const currentY = info.point.y;
    const currentHeightFraction = 1 - currentY / viewportHeight;
    const next = resolveSnapState(currentHeightFraction, -info.velocity.y);
    setSheetState(next);
  }

  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.15}
      onDragEnd={handleDragEnd}
      animate={controls}
      initial={{ y: `${(1 - SNAP_HEIGHTS.peek) * 100}%` }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className={cn(
        'glass fixed left-0 right-0 bottom-0 z-20 rounded-t-sheet',
        'flex flex-col overflow-hidden'
      )}
      style={{ height: '90vh' }}
    >
      <div className="mx-auto mt-1x h-1 w-10 shrink-0 rounded-pill bg-ink-muted/40" />
      <div className="overflow-y-auto px-3x pb-6x pt-2x">
        {peek}
        {(sheetState === 'half' || sheetState === 'full') && half}
        {sheetState === 'full' && full}
      </div>
    </motion.div>
  );
}
