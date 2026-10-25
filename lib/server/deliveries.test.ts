import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { demoMinistry } from '@/lib/data/seed';
import { deliveryRecipientGroups } from '@/lib/report-builder';
import { runDueDeliveries, type Deps } from '@/lib/server/deliveries';
import type { Delivery } from '@/lib/types/model';

/* Thursday 2026-10-29, 10:00 in Chicago (15:00 UTC): the seeded weekly
   deliveries are due at 9:00 that morning. */
const THU_10AM = Date.UTC(2026, 9, 29, 15, 0);
const ORG = 'org-1';

type Row = Record<string, unknown>;

/* Just enough of supabase-js for the job: filters, insert with a unique
   key, update, single, in, and the delivery_emails RPC. */
function fakeDb(tables: Record<string, Row[]>, emails: Record<string, string>) {
  const q = (table: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let patch: Row | null = null;
    const rows = () => (tables[table] ??= []).filter((r) => filters.every((f) => f(r)));
    const run = () => {
      if (patch) for (const r of rows()) Object.assign(r, patch);
      return { data: rows(), error: null };
    };
    const b = {
      select: () => b,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
      in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), b),
      order: () => b,
      limit: () => b,
      single: async () => ({ data: rows()[0] ?? null, error: null }),
      update: (p: Row) => ((patch = p), b),
      insert: async (row: Row) => {
        const t = (tables[table] ??= []);
        if (table === 'report_sends' && t.some((r) => r.org_id === row.org_id && r.delivery_id === row.delivery_id && r.period === row.period)) return { error: { code: '23505', message: 'duplicate key' } };
        t.push({ status: 'sending', sent: 0, missing: [], ...row });
        return { error: null };
      },
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, bad)
    };
    return b;
  };
  return {
    from: q,
    rpc: async (_name: string, args: { p_names: string[] }) => ({ data: args.p_names.filter((n) => emails[n.toLowerCase()]).map((n) => ({ name: n, email: emails[n.toLowerCase()] })), error: null })
  } as unknown as SupabaseClient;
}

function setup(over: Partial<Delivery>[] = [{}], configured = true) {
  const d = demoMinistry(THU_10AM);
  d.config.timeZone = 'America/Chicago';
  d.deliveries = over.map((o, i) => ({ id: 'dl' + i, report: 'standings', audience: 'leaders', scope: 'all', cadence: 'weekly', day: 4, time: '09:00', on: true, ...o }));
  const names = deliveryRecipientGroups(d, d.deliveries[0]).flatMap((g) => g.names);
  const emails = Object.fromEntries(names.slice(1).map((n, i) => [n.toLowerCase(), 'person' + i + '@example.org']));
  const tables: Record<string, Row[]> = {
    ministry_docs: [{ org_id: ORG, key: 'deliveries', value: d.deliveries }],
    organizations: [{ id: ORG, config: d.config }],
    report_sends: []
  };
  const sent: { to: string; subject: string }[] = [];
  const deps: Deps = { db: fakeDb(tables, emails), load: async () => d, mail: async (m) => void sent.push({ to: m.to, subject: m.subject }), configured };
  return { d, names, tables, sent, deps };
}

describe('scheduled report emails', () => {
  it('sends a due delivery once, to everyone with an email on file, and says who had none', async () => {
    const { names, tables, sent, deps } = setup();
    expect(names.length).toBeGreaterThan(1);
    const out = await runDueDeliveries(THU_10AM, 'https://app.test/console?tab=reports', deps);
    expect(out.results).toHaveLength(1);
    expect(out.results[0]).toMatchObject({ status: 'sent', sent: names.length - 1, missing: [names[0]] });
    expect(sent).toHaveLength(names.length - 1);
    expect(sent[0].subject).toContain('Standings');
    expect(tables.report_sends[0]).toMatchObject({ status: 'sent', period: 'w:2026-10-29' });
    const again = await runDueDeliveries(THU_10AM + 15 * 60_000, 'u', deps);
    expect(again.results).toHaveLength(0);
    expect(sent).toHaveLength(names.length - 1);
  });

  it('waits until it is due, by the ministry’s clock', async () => {
    const { sent, deps } = setup();
    const out = await runDueDeliveries(Date.UTC(2026, 9, 29, 13, 30), 'u', deps); // 8:30 in Chicago
    expect(out.results).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it('skips a period more than a day overdue rather than sending it late', async () => {
    const { deps } = setup([{ day: 2 }]); // Tuesday's — two days ago
    expect((await runDueDeliveries(THU_10AM, 'u', deps)).results).toHaveLength(0);
  });

  it('records why when email isn’t set up, and sends nothing', async () => {
    const { tables, sent, deps } = setup([{}], false);
    const out = await runDueDeliveries(THU_10AM, 'u', deps);
    expect(out.results[0].status).toBe('skipped');
    expect(sent).toHaveLength(0);
    expect(tables.report_sends[0].status).toBe('skipped');
  });

  it('leaves paused deliveries alone', async () => {
    const { deps } = setup([{ on: false }]);
    expect((await runDueDeliveries(THU_10AM, 'u', deps)).results).toHaveLength(0);
  });

  it('marks a send failed when the email service refuses, so it can be seen', async () => {
    const { tables, deps } = setup();
    deps.mail = async () => {
      throw new Error('The email service answered 422: bad sender');
    };
    const out = await runDueDeliveries(THU_10AM, 'u', deps);
    expect(out.results[0]).toMatchObject({ status: 'failed', error: 'The email service answered 422: bad sender' });
    expect(tables.report_sends[0].status).toBe('failed');
  });
});
