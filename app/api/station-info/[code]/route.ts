import { NextResponse } from 'next/server';
import { badRequest, cached, isStationCode, upstreamFailure } from '@/lib/api';
import { getStationInfo } from '@/lib/sources/ixigo';

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  if (!isStationCode(code)) return badRequest('invalid station code');
  try {
    const info = await cached(`stninfo:${code}`, 7 * 86_400, () => getStationInfo(code));
    return NextResponse.json({ code, info });
  } catch (err) {
    return upstreamFailure(err, 'station-info');
  }
}
