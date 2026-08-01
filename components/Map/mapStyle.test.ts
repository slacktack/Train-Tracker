import { describe, it, expect } from 'vitest';
import { getMapStyleUrl } from './mapStyle';

describe('getMapStyleUrl', () => {
  it('uses the dark style id for dark theme', () => {
    expect(getMapStyleUrl('dark', 'KEY')).toContain('streets-v2-dark');
  });

  it('uses the light style id for light theme', () => {
    expect(getMapStyleUrl('light', 'KEY')).toContain('streets-v2-light');
  });

  it('includes the API key as a query param', () => {
    expect(getMapStyleUrl('light', 'abc123')).toContain('key=abc123');
  });
});
