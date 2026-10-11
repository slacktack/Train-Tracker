'use client';

import type { Watch } from '@/lib/watch';

export type PushSupport = 'ok' | 'unsupported' | 'not-configured' | 'denied';

function keyBytes(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const existing = await navigator.serviceWorker.getRegistration();
  // Dev builds skip the SW: its static cache would serve stale chunks.
  if (existing || process.env.NODE_ENV !== 'production') return existing ?? null;
  return navigator.serviceWorker.register('/sw.js').catch(() => null);
}

export async function pushSupport(): Promise<PushSupport> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  if (process.env.NODE_ENV !== 'production') return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const cfg = await fetch('/api/push/subscribe').then((r) => r.json()).catch(() => null);
  return cfg?.enabled ? 'ok' : 'not-configured';
}

async function send(sub: PushSubscription, watches: Watch[]): Promise<boolean> {
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), watches }),
  });
  return res.ok;
}

// Asks permission, subscribes this browser and uploads its watches.
export async function enablePush(watches: Watch[]): Promise<PushSupport> {
  const support = await pushSupport();
  if (support !== 'ok') return support;
  if ((await Notification.requestPermission()) !== 'granted') return 'denied';
  const reg = await registration();
  if (!reg) return 'unsupported';
  const cfg = await fetch('/api/push/subscribe').then((r) => r.json());
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(cfg.publicKey) as BufferSource }));
  return (await send(sub, watches)) ? 'ok' : 'not-configured';
}

export async function syncPush(watches: Watch[]): Promise<void> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await send(sub, watches).catch(() => {});
}

export async function disablePush(): Promise<void> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}
