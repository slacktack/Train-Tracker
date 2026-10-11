import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { allIds, deleteRecord, getRecord, pushConfigured, putRecord } from '@/lib/push-store';
import { checkWatch } from '@/lib/watch-check';
import type { EvalResult } from '@/lib/watch';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Called by a scheduler (see .github/workflows/watch-alerts.yml) with the CRON_SECRET bearer token.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: 'push not configured' }, { status: 501 });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:alerts@example.com', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);

  const now = Date.now();
  // Several browsers can watch the same thing; check each upstream once per run.
  const memo = new Map<string, Promise<EvalResult>>();
  let sent = 0;
  let dropped = 0;
  let failed = 0;

  for (const id of await allIds()) {
    const rec = await getRecord(id);
    if (!rec) {
      await deleteRecord(id);
      continue;
    }
    const kept = [];
    let gone = false;
    for (const w of rec.watches) {
      const key = `${w.id}|${w.kind === 'seat' ? w.lastStatus ?? '' : ''}|${w.kind === 'trip' ? `${w.lastPlatform ?? ''}:${w.lastDelayStep ?? 0}` : ''}|${w.firedAt ?? ''}`;
      if (!memo.has(key)) memo.set(key, checkWatch(w, now).catch(() => ({ alert: null, next: w, done: false })));
      const r = await memo.get(key)!;
      if (r.alert) {
        try {
          await webpush.sendNotification(rec.subscription, JSON.stringify({ ...r.alert, tag: w.id }), { TTL: 3600, urgency: 'high' });
          sent += 1;
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code !== 404 && code !== 410) {
            failed += 1;
            console.warn('[cron/watches] push send failed:', code ?? (err instanceof Error ? err.message : err));
          }
          if (code === 404 || code === 410) {
            await deleteRecord(id);
            dropped += 1;
            gone = true;
            break;
          }
        }
      }
      if (!r.done) kept.push(r.next);
    }
    if (gone) continue;
    if (kept.length) await putRecord(id, { ...rec, watches: kept, updatedAt: rec.updatedAt });
    else await deleteRecord(id);
  }
  return NextResponse.json({ ok: true, checked: memo.size, sent, dropped, failed });
}
