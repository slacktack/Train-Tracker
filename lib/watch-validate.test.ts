import { describe, expect, it } from 'vitest';
import { cleanWatches } from './watch-validate';
import { mergeWatches } from './push-store';

describe('cleanWatches', () => {
  it('keeps known fields and rebuilds ids', () => {
    const out = cleanWatches([{ kind: 'seat', id: 'evil', train: '12952', date: '2026-10-25', from: 'ndls', to: 'MMCT', cls: '3a', quota: 'GN', pnr: '1234567890' }]);
    expect(out).toEqual([{ kind: 'seat', id: 'seat:12952:NDLS:MMCT:2026-10-25:3A:GN', train: '12952', date: '2026-10-25', trainName: '', firedAt: undefined, from: 'NDLS', to: 'MMCT', cls: '3A', quota: 'GN', lastStatus: undefined }]);
  });
  it('rejects bad input', () => {
    expect(cleanWatches('x')).toBeNull();
    expect(cleanWatches([{ kind: 'seat', train: '1', date: '2026-10-25' }])).toBeNull();
    expect(cleanWatches([{ kind: 'other', train: '12952', date: '2026-10-25' }])).toBeNull();
    expect(cleanWatches(Array.from({ length: 21 }, () => ({})))).toBeNull();
  });
});

describe('mergeWatches', () => {
  it('keeps server progress for watches the client still has', () => {
    const client = cleanWatches([{ kind: 'trip', train: '12952', date: '2026-10-25', station: 'NDLS' }])!;
    const server = [{ ...client[0], lastPlatform: '3', lastDelayStep: 1 }];
    expect(mergeWatches(client, server)[0]).toMatchObject({ lastPlatform: '3', lastDelayStep: 1 });
    expect(mergeWatches([], server)).toEqual([]);
  });
});
