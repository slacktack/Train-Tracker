import { describe, it, expect } from 'vitest';
import { resolveSnapState, SNAP_HEIGHTS } from './snapPhysics';

describe('resolveSnapState', () => {
  it('snaps to nearest state with no fling', () => {
    expect(resolveSnapState(0.05, 0)).toBe('peek');
    expect(resolveSnapState(0.6, 0)).toBe('half');
    expect(resolveSnapState(0.9, 0)).toBe('full');
  });

  it('a fast downward fling drops one level from half', () => {
    expect(resolveSnapState(SNAP_HEIGHTS.half, -800)).toBe('peek');
  });

  it('an upward fling from half raises to full', () => {
    expect(resolveSnapState(SNAP_HEIGHTS.half, 800)).toBe('full');
  });

  it('an upward fling from peek raises to half', () => {
    expect(resolveSnapState(SNAP_HEIGHTS.peek, 800)).toBe('half');
  });

  it('does not undershoot past peek on a downward fling from peek', () => {
    expect(resolveSnapState(SNAP_HEIGHTS.peek, -800)).toBe('peek');
  });
});
