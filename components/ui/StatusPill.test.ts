import { describe, it, expect } from 'vitest';
import { statusLabel } from './StatusPill';

describe('statusLabel', () => {
  it('labels on-time trains', () => {
    expect(statusLabel('running', 0).label).toBe('On time');
  });

  it('labels minor delays under 15 minutes as amber', () => {
    const result = statusLabel('running', 6);
    expect(result.label).toBe('Delayed 6m');
    expect(result.colorClass).toBe('bg-status-minorDelay');
  });

  it('labels delays of 15+ minutes as heavy/red', () => {
    const result = statusLabel('running', 20);
    expect(result.colorClass).toBe('bg-status-heavyDelay');
  });

  it('labels cancelled trains distinctly', () => {
    expect(statusLabel('cancelled', 0).label).toBe('Cancelled');
  });
});
