'use client';
/* Push on this phone: turning it on and off, and keeping the server's copy
   of this phone's notification choices in step. The subscription belongs to
   whoever is signed in here; signing out drops it. */
import { VAPID_PUBLIC_KEY, keyBytes } from '@/lib/push';
import { supabaseBrowser } from '@/lib/supabase/client';

export type PushState = 'checking' | 'unsupported' | 'install' | 'not-set-up' | 'blocked' | 'off' | 'on';

const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** Before asking anything: can this browser take push at all? An iPhone
 *  only can once SquadRise is on its Home Screen. */
export function pushCapability(): Exclude<PushState, 'checking' | 'off' | 'on'> | 'ok' {
  if (supported()) return VAPID_PUBLIC_KEY ? (Notification.permission === 'denied' ? 'blocked' : 'ok') : 'not-set-up';
  if (typeof window === 'undefined') return 'unsupported';
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !installed ? 'install' : 'unsupported';
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration('/')) ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/' }));
}

export async function currentPush(): Promise<PushSubscription | null> {
  if (!supported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function pushState(): Promise<PushState> {
  const cap = pushCapability();
  if (cap !== 'ok') return cap;
  return (await currentPush()) && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Ask the browser, subscribe, and file it for whoever is signed in. */
export async function turnOnPush(prefs: Record<string, boolean>): Promise<PushState> {
  const cap = pushCapability();
  if (cap !== 'ok') return cap;
  const perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (perm !== 'granted') return 'blocked';
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const key = keyBytes(VAPID_PUBLIC_KEY);
  let sub = await reg.pushManager.getSubscription();
  /* A subscription made with an older key can't be reused. */
  if (sub && sub.options.applicationServerKey && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const j = sub.toJSON();
  const r = await supabaseBrowser().rpc('push_subscribe', { p_endpoint: sub.endpoint, p_p256dh: j.keys?.p256dh ?? '', p_auth: j.keys?.auth ?? '', p_prefs: prefs });
  if (r.error) throw new Error(r.error.message);
  return 'on';
}

function sameKey(a: ArrayBuffer, b: Uint8Array) {
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

export async function turnOffPush(): Promise<void> {
  const sub = await currentPush();
  if (!sub) return;
  await supabaseBrowser().from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

/** This phone's own on/off choices, so the server filters the same way the
 *  in-app list does. */
export async function syncPushPrefs(prefs: Record<string, boolean>): Promise<void> {
  const sub = await currentPush();
  if (sub) await supabaseBrowser().rpc('push_prefs', { p_endpoint: sub.endpoint, p_prefs: prefs });
}

/** Signing out: this phone stops getting that person's pushes. Never holds
 *  the sign-out up for long. */
export function dropPushHere(): Promise<void> {
  const drop = turnOffPush().catch(() => undefined);
  return Promise.race([drop, new Promise<void>((r) => setTimeout(r, 1500))]);
}

/** A real push to this person's phones, through the push service. */
export async function sendTestPush(): Promise<{ sent?: number; phones?: number; error?: string }> {
  const r = await fetch('/api/push/test', { method: 'POST' });
  return (await r.json().catch(() => ({ error: 'The server said ' + r.status }))) as { sent?: number; phones?: number; error?: string };
}
