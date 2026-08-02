'use client';

import { motion, useAnimation, useDragControls, PanInfo } from 'framer-motion';
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
  const dragControls = useDragControls();
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  // Sheet is full viewport height; snaps translate it down. Clamp the drag so it
  // can never rise above the 'full' position (95% is the maximum, below the
  // status bar).
  const topLimit = (1 - SNAP_HEIGHTS.full) * viewportHeight;
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

  function expandFromPeek() {
    if (sheetState === 'peek') setSheetState('half');
  }

  return (
    <motion.div
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: topLimit, bottom: bottomLimit }}
      dragElastic={0.15}
      onDragEnd={handleDragEnd}
      animate={controls}
      initial={{ y: `${(1 - SNAP_HEIGHTS.peek) * 100}%` }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className={cn(
        'fixed bottom-0 left-0 right-0 z-20 rounded-t-sheet border-t border-ink/10',
        // A full-viewport-height 2xl blur recalculating every drag frame was
        // the single biggest source of jank on real phones — md is much
        // cheaper and still reads as glass over the map.
        'bg-surface-raised/90 shadow-glass backdrop-blur-md',
        'flex flex-col overflow-hidden'
      )}
      style={{ height: '100vh' }}
    >
      {/* Only this handle area starts the drag gesture — the content below
          scrolls normally instead of fighting the sheet for vertical gestures. */}
      <button
        type="button"
        onPointerDown={(e) => dragControls.start(e)}
        onClick={expandFromPeek}
        aria-label={sheetState === 'peek' ? 'Expand train details' : 'Resize train details'}
        className="flex shrink-0 cursor-grab touch-none flex-col items-center gap-1x py-2x active:cursor-grabbing"
      >
        <span className="h-1.5 w-12 rounded-pill bg-ink-muted/50" aria-hidden />
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3x pb-[calc(env(safe-area-inset-bottom)+24px)]">
        {peek}
        {/* Always mounted (not conditional on sheetState) so expanding the
            sheet doesn't pay a first-mount delay — it's simply revealed. */}
        <div className={sheetState === 'peek' ? 'hidden' : undefined}>{half}</div>
      </div>
    </motion.div>
  );
}
