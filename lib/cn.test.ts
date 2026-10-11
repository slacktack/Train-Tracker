import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('keeps custom font sizes next to text colours', () => {
    expect(cn('text-caption', 'text-ink-muted')).toBe('text-caption text-ink-muted');
    expect(cn('text-caption', 'text-body')).toBe('text-body');
  });
});
