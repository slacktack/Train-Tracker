import { NextRequest, NextResponse } from 'next/server';
import { searchTrains } from '@/lib/railradar';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const results = await searchTrains(q);
  return NextResponse.json(results);
}
