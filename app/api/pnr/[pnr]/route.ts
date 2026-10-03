import { NextResponse } from 'next/server';
import { badRequest, cached, isPnr, upstreamFailure } from '@/lib/api';
import { getPnr } from '@/lib/sources/confirmtkt';

export async function GET(_req: Request, { params }: { params: { pnr: string } }) {
  if (!isPnr(params.pnr)) return badRequest('PNR must be exactly 10 digits');
  try {
    const result = await cached(`pnr:${params.pnr}`, 60, () => getPnr(params.pnr));
    return NextResponse.json(result);
  } catch (err) {
    return upstreamFailure(err, 'pnr');
  }
}
