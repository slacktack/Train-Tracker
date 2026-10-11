import { NextRequest, NextResponse } from 'next/server';
import { badRequest } from '@/lib/api';
import { checkWatch } from '@/lib/watch-check';
import { cleanWatches } from '@/lib/watch-validate';

export const dynamic = 'force-dynamic';

// The open app's checker: same evaluation as the push cron.
export async function POST(req: NextRequest) {
  const watches = cleanWatches((await req.json().catch(() => null))?.watches);
  if (!watches) return badRequest('invalid watches');
  const results = await Promise.all(
    watches.map((w) => checkWatch(w).catch(() => ({ alert: null, next: w, done: false }))),
  );
  return NextResponse.json({ results });
}
