export type SheetSnapState = 'peek' | 'half' | 'full';

export const SNAP_HEIGHTS: Record<SheetSnapState, number> = {
  peek: 0.12,
  half: 0.45,
  full: 0.9,
};

const ORDER: SheetSnapState[] = ['peek', 'half', 'full'];

export function resolveSnapState(
  currentHeightFraction: number,
  velocity: number,
  flingThreshold = 500
): SheetSnapState {
  if (velocity > flingThreshold) {
    const currentIdx = ORDER.findIndex((s) => SNAP_HEIGHTS[s] >= currentHeightFraction);
    const idx = currentIdx === -1 ? ORDER.length - 1 : currentIdx;
    return ORDER[Math.max(0, idx - 1)];
  }
  if (velocity < -flingThreshold) {
    const currentIdx = ORDER.findIndex((s) => SNAP_HEIGHTS[s] >= currentHeightFraction);
    const idx = currentIdx === -1 ? ORDER.length - 1 : currentIdx;
    return ORDER[Math.min(ORDER.length - 1, idx + 1)];
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
