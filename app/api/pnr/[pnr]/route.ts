import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { badRequest, cached, isPnr, upstreamFailure } from '@/lib/api';
import { getPnr } from '@/lib/sources/confirmtkt';

const PRIVATE = { 'Cache-Control': 'private, no-store' };

export async function GET(_req: Request, { params }: { params: { pnr: string } }) {
  if (!isPnr(params.pnr)) return badRequest('PNR must be exactly 10 digits');
  // Hashed so the raw PNR never becomes a cache key or log line.
  const key = `pnr:${createHash('sha256').update(params.pnr).digest('hex').slice(0, 32)}`;
  try {
    const result = await cached(key, 60, () => getPnr(params.pnr));
    return NextResponse.json(result, { headers: PRIVATE });
  } catch (err) {
    const res = upstreamFailure(err, 'pnr');
    res.headers.set('Cache-Control', 'private, no-store');
    return res;
  }
}
