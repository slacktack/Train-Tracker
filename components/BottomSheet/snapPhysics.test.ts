import { describe, it, expect } from 'vitest';
import { resolveSnapState, SNAP_HEIGHTS } from './snapPhysics';

describe('resolveSnapState', () => {
  it('snaps to nearest state with no fling', () => {
    expect(resolveSnapState(0.13, 0)).toBe('peek');
    expect(resolveSnapState(0.4, 0)).toBe('half');
    expect(resolveSnapState(0.85, 0)).toBe('full');
  });

  it('a fast downward fling drops one level from half', () => {
    expect(resolveSnapState(SNAP_HEIGHTS.half, 800)).toBe('peek');
  });

  it('a fast upward fling raises one level from half', () => {
    expect(resolveSnapState(SNAP_HEIGHTS.half, -800)).toBe('full');
  });

  it('does not overshoot past full on an upward fling from full', () => {
    expect(resolveSnapState(SNAP_HEIGHTS.full, -800)).toBe('full');
  });

  it('does not undershoot past peek on a downward fling from peek', () => {
    expect(resolveSnapState(SNAP_HEIGHTS.peek, 800)).toBe('peek');
  });
});
