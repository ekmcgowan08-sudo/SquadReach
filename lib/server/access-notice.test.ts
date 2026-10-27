import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Mail } from '@/lib/email/send';
import { notifyLeaders } from '@/lib/server/access-notice';

const row = (to: string) => ({ ministry: 'Grace Community Students', name: 'Sam Ortiz', email: 'sam@example.org', requested_role: 'coach', note: '', to_email: to });
const db = (rows: unknown[], error: { message: string } | null = null) => ({ rpc: async () => ({ data: error ? null : rows, error }) }) as unknown as SupabaseClient;

describe('telling leaders about a new request', () => {
  it('mails every leader and owner the server lists, with the role as people read it', async () => {
    const sent: Mail[] = [];
    const r = await notifyLeaders('req-1', 'https://app.example/console', { db: db([row('pastor@example.org'), row('lead@example.org')]), mail: async (m) => void sent.push(m), configured: true });
    expect(r).toEqual({ sent: 2, failed: [] });
    expect(sent.map((m) => m.to)).toEqual(['pastor@example.org', 'lead@example.org']);
    expect(sent[0].subject).toBe('Access request: Sam Ortiz (Coach) at Grace Community Students');
  });

  it('keeps going past a failed send, and names it', async () => {
    const r = await notifyLeaders('req-1', 'u', {
      db: db([row('a@example.org'), row('b@example.org')]),
      mail: async (m) => {
        if (m.to === 'a@example.org') throw new Error('bounced');
      },
      configured: true
    });
    expect(r).toEqual({ sent: 1, failed: ['a@example.org'] });
  });

  it('sends nothing without an email service or the service role', async () => {
    let calls = 0;
    const mail = async () => void calls++;
    expect(await notifyLeaders('req-1', 'u', { db: db([row('a@example.org')]), mail, configured: false })).toEqual({ sent: 0, skipped: 'not set up' });
    expect(await notifyLeaders('req-1', 'u', { db: null, mail, configured: true })).toEqual({ sent: 0, skipped: 'not set up' });
    expect(calls).toBe(0);
  });

  it('reports a database error rather than throwing', async () => {
    expect(await notifyLeaders('req-1', 'u', { db: db([], { message: 'boom' }), mail: async () => {}, configured: true })).toEqual({ sent: 0, error: 'boom' });
  });
});
