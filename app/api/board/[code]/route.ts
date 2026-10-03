import { NextRequest, NextResponse } from 'next/server';
import { badRequest, cached, isStationCode, upstreamFailure } from '@/lib/api';
import { getStation } from '@/lib/sources/offline';
import { getWimtBoard } from '@/lib/sources/wimt';

const WINDOWS = [2, 4, 8];

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  if (!isStationCode(code)) return badRequest('invalid station code');
  const station = getStation(code);
  if (!station) return NextResponse.json({ error: `Unknown station ${code}`, code: 'not_found' }, { status: 404 });
  const hrs = Number(req.nextUrl.searchParams.get('hrs') ?? 4);
  if (!WINDOWS.includes(hrs)) return badRequest('hrs must be 2, 4 or 8');

  try {
    const board = await cached(`board:${code}:${hrs}`, 45, () => getWimtBoard(code, hrs));
    return NextResponse.json({ station, hrs, ...board });
  } catch (err) {
    return upstreamFailure(err, 'board');
  }
}
