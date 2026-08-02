export type SheetSnapState = 'peek' | 'half';

export const SNAP_HEIGHTS: Record<SheetSnapState, number> = {
  peek: 0.12,
  half: 0.5,
};

const ORDER: SheetSnapState[] = ['peek', 'half'];

const FLING_EPSILON = 0.05;

export function resolveSnapState(
  currentHeightFraction: number,
  velocity: number,
  flingThreshold = 500
): SheetSnapState {
  if (velocity > flingThreshold) {
    const next = ORDER.find((s) => SNAP_HEIGHTS[s] > currentHeightFraction + FLING_EPSILON);
    return next ?? 'half';
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
