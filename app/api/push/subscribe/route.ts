import { NextRequest, NextResponse } from 'next/server';
import { badRequest } from '@/lib/api';
import { deleteRecord, getRecord, mergeWatches, pushConfigured, putRecord, subId } from '@/lib/push-store';
import { cleanWatches } from '@/lib/watch-validate';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ enabled: pushConfigured(), publicKey: pushConfigured() ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY : null });
}

// Upserts this browser's push subscription with its full watch list.
export async function POST(req: NextRequest) {
  if (!pushConfigured()) return NextResponse.json({ error: 'Background alerts are not configured', code: 'push_disabled' }, { status: 501 });
  const body = (await req.json().catch(() => null)) as { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }; watches?: unknown } | null;
  const sub = body?.subscription;
  if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return badRequest('invalid subscription');
  const watches = cleanWatches(body?.watches ?? []);
  if (!watches) return badRequest('invalid watches');
  const id = subId(sub.endpoint);
  if (watches.length === 0) {
    await deleteRecord(id);
    return NextResponse.json({ ok: true, watches: 0 });
  }
  const prev = await getRecord(id);
  await putRecord(id, {
    subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
    watches: mergeWatches(watches, prev?.watches),
    updatedAt: Date.now(),
  });
  return NextResponse.json({ ok: true, watches: watches.length });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return badRequest('endpoint required');
  await deleteRecord(subId(body.endpoint));
  return NextResponse.json({ ok: true });
}
