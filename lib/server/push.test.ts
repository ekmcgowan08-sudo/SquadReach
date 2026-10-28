import { createECDH, randomBytes } from 'node:crypto';
import webpush from 'web-push';
import { describe, expect, it } from 'vitest';
import { flushPushes, pushToUser, vapidOptions, type PushStore, type QueuedPush, type SendPush, type Sub } from '@/lib/server/push';
import { PUSH_FRESH_MS, wantsPush, keyBytes, type PushPayload } from '@/lib/push';

const NOW = Date.parse('2026-11-04T23:30:00Z');

interface Row extends QueuedPush {
  created: number;
  sentAt: number | null;
  sent: number | null;
}

function memory(rows: Partial<Row>[], subs: Sub[], defaults: Record<string, Record<string, unknown>> = {}) {
  const q: Row[] = rows.map((r, i) => ({ id: 'p' + i, org_id: 'org', to_users: [], trigger: 'event', title: 'T', body: 'B', url: '/dashboard', created: NOW, sentAt: null, sent: null, ...r }));
  let phones = [...subs];
  const store: PushStore = {
    async expire(before, now, orgId) {
      for (const r of q) if (r.sentAt == null && r.created < Date.parse(before) && (!orgId || r.org_id === orgId)) Object.assign(r, { sentAt: Date.parse(now), sent: 0 });
    },
    async claim(since, now, orgId) {
      const got = q.filter((r) => r.sentAt == null && r.created >= Date.parse(since) && (!orgId || r.org_id === orgId));
      for (const r of got) r.sentAt = Date.parse(now);
      return got;
    },
    async subscriptions(users) {
      return phones.filter((s) => users.includes(s.user_id));
    },
    async defaults(orgIds) {
      return new Map(orgIds.map((o) => [o, defaults[o] ?? {}]));
    },
    async record(id, sent) {
      q.find((r) => r.id === id)!.sent = sent;
    },
    async drop(endpoints) {
      phones = phones.filter((s) => !endpoints.includes(s.endpoint));
    }
  };
  return { store, q, phones: () => phones };
}

const sub = (user: string, endpoint: string, prefs: Record<string, unknown> = {}): Sub => ({ endpoint, user_id: user, p256dh: 'k', auth: 'a', prefs });
const recorder = (fail: Record<string, number> = {}) => {
  const got: { endpoint: string; payload: PushPayload }[] = [];
  const send: SendPush = async (s, payload) => {
    if (fail[s.endpoint]) throw Object.assign(new Error('push service said no'), { statusCode: fail[s.endpoint] });
    got.push({ endpoint: s.endpoint, payload });
  };
  return { got, send };
};

describe('sending what the database queued', () => {
  it('pushes each queued row to every phone of everyone it is for', async () => {
    const m = memory([{ to_users: ['mike', 'dana'], title: 'Swap request', body: 'Chris can’t do games on Wed, Nov 4', url: '/dashboard/serving', trigger: 'nightCycle' }], [sub('mike', 'https://p/1'), sub('mike', 'https://p/2'), sub('dana', 'https://p/3'), sub('chris', 'https://p/4')]);
    const r = recorder();
    expect(await flushPushes(m.store, r.send, NOW)).toEqual({ pushes: 1, sent: 3, dropped: 0 });
    expect(r.got.map((g) => g.endpoint).sort()).toEqual(['https://p/1', 'https://p/2', 'https://p/3']);
    expect(r.got[0].payload).toEqual({ title: 'Swap request', body: 'Chris can’t do games on Wed, Nov 4', url: '/dashboard/serving', tag: 'nightCycle:p0' });
    expect(m.q[0].sent).toBe(3);
  });

  it('sends a row once, however many phones ask', async () => {
    const m = memory([{ to_users: ['mike'] }], [sub('mike', 'https://p/1')]);
    const r = recorder();
    await Promise.all([flushPushes(m.store, r.send, NOW), flushPushes(m.store, r.send, NOW)]);
    expect(r.got).toHaveLength(1);
  });

  it('keeps to one ministry when a phone asks, and all of them for the cron', async () => {
    const m = memory([{ to_users: ['mike'] }, { to_users: ['mike'], org_id: 'other' }], [sub('mike', 'https://p/1')]);
    const r = recorder();
    expect((await flushPushes(m.store, r.send, NOW, 'org')).pushes).toBe(1);
    expect((await flushPushes(m.store, r.send, NOW)).pushes).toBe(1);
    expect(r.got).toHaveLength(2);
  });

  it('honours what each phone switched off, then the ministry default', async () => {
    const m = memory(
      [{ to_users: ['mike', 'dana', 'sam'], trigger: 'prayer' }],
      [sub('mike', 'https://p/1', { prayer: false }), sub('dana', 'https://p/2'), sub('sam', 'https://p/3', { prayer: true })],
      { org: { prayer: false } }
    );
    const r = recorder();
    await flushPushes(m.store, r.send, NOW);
    expect(r.got.map((g) => g.endpoint)).toEqual(['https://p/3']);
  });

  it('drops a push that waited too long rather than sending it late', async () => {
    const m = memory([{ to_users: ['mike'], created: NOW - PUSH_FRESH_MS - 1 }], [sub('mike', 'https://p/1')]);
    const r = recorder();
    expect(await flushPushes(m.store, r.send, NOW)).toEqual({ pushes: 0, sent: 0, dropped: 0 });
    expect(m.q[0]).toMatchObject({ sent: 0 });
    expect(m.q[0].sentAt).not.toBeNull();
  });

  it('forgets a phone the push service says is gone, and keeps going past other failures', async () => {
    const m = memory([{ to_users: ['mike'] }, { to_users: ['mike'] }], [sub('mike', 'https://p/gone'), sub('mike', 'https://p/busy'), sub('mike', 'https://p/ok')]);
    const r = recorder({ 'https://p/gone': 410, 'https://p/busy': 503 });
    expect(await flushPushes(m.store, r.send, NOW)).toEqual({ pushes: 2, sent: 2, dropped: 1 });
    expect(m.phones().map((s) => s.endpoint)).toEqual(['https://p/busy', 'https://p/ok']);
  });

  it('without VAPID keys, closes the queue with nothing sent', async () => {
    const m = memory([{ to_users: ['mike'] }], [sub('mike', 'https://p/1')]);
    expect(await flushPushes(m.store, null, NOW)).toEqual({ pushes: 1, sent: 0, dropped: 0, skipped: 'not set up' });
    expect(m.q[0].sent).toBe(0);
  });

  it('sends a test to the asker’s own phones only', async () => {
    const m = memory([], [sub('mike', 'https://p/1'), sub('mike', 'https://p/gone'), sub('dana', 'https://p/3')]);
    const r = recorder({ 'https://p/gone': 404 });
    expect(await pushToUser(m.store, r.send, 'mike', { title: 't', body: 'b', url: '/', tag: 'x' })).toEqual({ sent: 1, phones: 2 });
    expect(m.phones().map((s) => s.endpoint)).toEqual(['https://p/1', 'https://p/3']);
  });
});

describe('the phone’s side', () => {
  it('wants a push unless this phone or the ministry turned it off', () => {
    expect(wantsPush({}, {}, 'event')).toBe(true);
    expect(wantsPush({ event: false }, { event: true }, 'event')).toBe(false);
    expect(wantsPush({ event: true }, { event: false }, 'event')).toBe(true);
    expect(wantsPush(null, { event: false }, 'event')).toBe(false);
    expect(wantsPush({ event: 'yes' }, undefined, 'event')).toBe(true);
  });

  it('turns the URL-safe public key into the bytes PushManager wants', () => {
    expect([...keyBytes('BAEC_w')]).toEqual([4, 1, 2, 255]);
  });
});

describe('the push itself', () => {
  it('is signed with the ministry server’s VAPID key and encrypted for the phone', () => {
    const keys = webpush.generateVAPIDKeys();
    const phone = createECDH('prime256v1');
    phone.generateKeys();
    const req = webpush.generateRequestDetails(
      { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: phone.getPublicKey('base64url'), auth: randomBytes(16).toString('base64url') } },
      JSON.stringify({ title: 'Swap request', body: 'b', url: '/dashboard/serving', tag: 't' }),
      vapidOptions('https://squadrise.example', keys.publicKey, keys.privateKey)
    );
    expect(req.method).toBe('POST');
    expect(req.headers.Authorization).toMatch(/^vapid t=.+, k=/);
    expect(req.headers['Content-Encoding']).toBe('aes128gcm');
    expect(req.headers.TTL).toBe(PUSH_FRESH_MS / 1000);
    expect(req.headers.Urgency).toBe('high');
    expect(String(req.body)).not.toContain('Swap request');
  });
});
