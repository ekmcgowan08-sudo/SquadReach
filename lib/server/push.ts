import 'server-only';
/* Sending what the database queued. Triggers fill push_outbox with who a
   push is for and what it says; this claims what's waiting (each row once,
   however many phones ask at the same moment), filters each subscription
   by the choices made on that phone, and sends over Web Push. A phone the
   push service says is gone is forgotten. Needs the service role and a
   VAPID key pair (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY). */
import type { SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { PUSH_FRESH_MS, VAPID_PUBLIC_KEY, wantsPush, type PushPayload } from '@/lib/push';
import { serviceClient } from '@/lib/server/deliveries';

export const pushConfigured = () => !!(VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

export interface Sub {
  endpoint: string;
  user_id: string;
  p256dh: string;
  auth: string;
  prefs: Record<string, unknown> | null;
}

export interface QueuedPush {
  id: string;
  org_id: string;
  to_users: string[];
  trigger: string;
  title: string;
  body: string;
  url: string;
}

/** The queue and the subscriptions, as this job needs them — swapped for an
 *  in-memory copy in tests. */
export interface PushStore {
  /** Close what waited too long, with nothing sent. */
  expire(before: string, now: string, orgId?: string): Promise<void>;
  /** Take what's waiting: marked sent before anything goes, so a second
   *  caller can't take it too. */
  claim(since: string, now: string, orgId?: string): Promise<QueuedPush[]>;
  subscriptions(users: string[]): Promise<Sub[]>;
  defaults(orgIds: string[]): Promise<Map<string, Record<string, unknown>>>;
  record(id: string, sent: number): Promise<void>;
  drop(endpoints: string[]): Promise<void>;
}

export function dbStore(db: SupabaseClient): PushStore {
  const must = (r: { error: { message: string } | null }) => {
    if (r.error) throw new Error(r.error.message);
  };
  return {
    async expire(before, now, orgId) {
      let q = db.from('push_outbox').update({ sent_at: now, sent: 0 }).is('sent_at', null).lt('created_at', before);
      if (orgId) q = q.eq('org_id', orgId);
      must(await q);
    },
    async claim(since, now, orgId) {
      let q = db.from('push_outbox').update({ sent_at: now }).is('sent_at', null).gte('created_at', since);
      if (orgId) q = q.eq('org_id', orgId);
      const r = await q.select('id, org_id, to_users, trigger, title, body, url');
      must(r);
      return (r.data ?? []) as QueuedPush[];
    },
    async subscriptions(users) {
      if (!users.length) return [];
      const r = await db.from('push_subscriptions').select('endpoint, user_id, p256dh, auth, prefs').in('user_id', users);
      must(r);
      return (r.data ?? []) as Sub[];
    },
    async defaults(orgIds) {
      const r = await db.from('organizations').select('id, config').in('id', orgIds);
      must(r);
      return new Map(((r.data ?? []) as { id: string; config: { notifDefaults?: Record<string, unknown> } | null }[]).map((o) => [o.id, o.config?.notifDefaults ?? {}]));
    },
    async record(id, sent) {
      must(await db.from('push_outbox').update({ sent }).eq('id', id));
    },
    async drop(endpoints) {
      if (endpoints.length) must(await db.from('push_subscriptions').delete().in('endpoint', endpoints));
    }
  };
}

export type SendPush = (sub: Sub, payload: PushPayload) => Promise<void>;

/** VAPID wants an https: or mailto: contact for the push services. */
export function vapidSubject(appUrl: string) {
  if (process.env.VAPID_SUBJECT) return process.env.VAPID_SUBJECT;
  const u = new URL(appUrl);
  return u.protocol === 'https:' ? u.origin : 'mailto:webmaster@localhost';
}

/** How each push is signed and how long the push service holds it. */
export const vapidOptions = (subject: string, publicKey = VAPID_PUBLIC_KEY, privateKey = process.env.VAPID_PRIVATE_KEY ?? ''): webpush.RequestOptions => ({
  vapidDetails: { subject, publicKey, privateKey },
  TTL: PUSH_FRESH_MS / 1000,
  urgency: 'high'
});

export const webPushSender =
  (subject: string): SendPush =>
  async (sub, payload) => {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), vapidOptions(subject));
  };

/** 404 and 410 mean the phone unsubscribed or the browser dropped it. */
const isGone = (e: unknown) => [404, 410].includes((e as { statusCode?: number })?.statusCode ?? 0);

export interface FlushResult {
  pushes: number;
  sent: number;
  dropped: number;
  skipped?: 'not set up';
}

/** Send everything queued for one ministry (a phone that just caused a
 *  push), or for all of them (the cron, catching what a phone didn't). */
export async function flushPushes(store: PushStore, send: SendPush | null, now: number, orgId?: string): Promise<FlushResult> {
  const stamp = new Date(now).toISOString();
  const since = new Date(now - PUSH_FRESH_MS).toISOString();
  await store.expire(since, stamp, orgId);
  const rows = await store.claim(since, stamp, orgId);
  if (!rows.length) return { pushes: 0, sent: 0, dropped: 0 };
  if (!send) {
    for (const r of rows) await store.record(r.id, 0);
    return { pushes: rows.length, sent: 0, dropped: 0, skipped: 'not set up' };
  }
  const subs = await store.subscriptions([...new Set(rows.flatMap((r) => r.to_users))]);
  const defaults = await store.defaults([...new Set(rows.map((r) => r.org_id))]);
  const gone = new Set<string>();
  let sent = 0;
  for (const r of rows) {
    const payload: PushPayload = { title: r.title, body: r.body, url: r.url, tag: r.trigger + ':' + r.id };
    const to = subs.filter((s) => r.to_users.includes(s.user_id) && !gone.has(s.endpoint) && wantsPush(s.prefs, defaults.get(r.org_id), r.trigger));
    const out = await Promise.allSettled(to.map((s) => send(s, payload)));
    out.forEach((o, i) => o.status === 'rejected' && isGone(o.reason) && gone.add(to[i].endpoint));
    const n = out.filter((o) => o.status === 'fulfilled').length;
    await store.record(r.id, n);
    sent += n;
  }
  await store.drop([...gone]);
  return { pushes: rows.length, sent, dropped: gone.size };
}

/** flushPushes with the real database and push services; null when the
 *  service role isn't set. */
export function sendQueuedPushes(appUrl: string, orgId?: string): Promise<FlushResult> | null {
  const db = serviceClient();
  if (!db) return null;
  return flushPushes(dbStore(db), pushConfigured() ? webPushSender(vapidSubject(appUrl)) : null, Date.now(), orgId);
}

/** "Send a test" from Notifications: straight to the asker's own phones. */
export async function pushToUser(store: PushStore, send: SendPush, userId: string, payload: PushPayload): Promise<{ sent: number; phones: number }> {
  const subs = await store.subscriptions([userId]);
  const out = await Promise.allSettled(subs.map((s) => send(s, payload)));
  await store.drop(subs.filter((s, i) => out[i].status === 'rejected' && isGone((out[i] as PromiseRejectedResult).reason)).map((s) => s.endpoint));
  return { sent: out.filter((o) => o.status === 'fulfilled').length, phones: subs.length };
}
