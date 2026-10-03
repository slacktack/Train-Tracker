import { NextRequest, NextResponse } from 'next/server';
import { searchStations } from '@/lib/sources/offline';

export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 8, 20);
  return NextResponse.json({ results: searchStations(q, limit) });
}
