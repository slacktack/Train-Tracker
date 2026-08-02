export type SheetSnapState = 'peek' | 'half' | 'full';

export const SNAP_HEIGHTS: Record<SheetSnapState, number> = {
  // 0.18 clipped 2-line-wrapped train names / stat values instead of showing
  // them in full; 0.23 gives peek room to show everything without an ellipsis.
  peek: 0.23,
  // 0.55 read as "barely moved" on a single pull-up — 0.8 makes one tap/drag
  // reveal nearly the full panel, matching what users expect from one gesture.
  half: 0.8,
  full: 0.95,
};

const ORDER: SheetSnapState[] = ['peek', 'half', 'full'];

const FLING_EPSILON = 0.05;

export function resolveSnapState(
  currentHeightFraction: number,
  velocity: number,
  flingThreshold = 500
): SheetSnapState {
  if (velocity > flingThreshold) {
    const next = ORDER.find((s) => SNAP_HEIGHTS[s] > currentHeightFraction + FLING_EPSILON);
    return next ?? 'full';
  }
  if (velocity < -flingThreshold) {
    const next = [...ORDER]
      .reverse()
      .find((s) => SNAP_HEIGHTS[s] < currentHeightFraction - FLING_EPSILON);
    return next ?? 'peek';
  }

  let closest: SheetSnapState = 'peek';
  let closestDist = Infinity;
  for (const state of ORDER) {
    const dist = Math.abs(SNAP_HEIGHTS[state] - currentHeightFraction);
    if (dist < closestDist) {
      closestDist = dist;
      closest = state;
    }
  }
  return closest;
}
