import 'server-only';
/* Report delivery by email, on the server. The schedule lives in the
   ministry's 'deliveries' document; recipients are worked out at send time
   (lib/report-builder) and matched to the addresses on file. Every send is
   claimed in report_sends first, keyed on (delivery, period), so the cron
   running twice — or a leader pressing Send now — never sends a period
   twice. Reads with the service role, so it needs SUPABASE_SERVICE_ROLE_KEY. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseBackend } from '@/lib/data/supabase-backend';
import { renderReport } from '@/lib/email/render';
import { emailConfigured, sendEmail } from '@/lib/email/send';
import { SUPABASE_URL } from '@/lib/env';
import { deliveryDue, deliveryRecipientGroups, reportSpec, runReport, scopedSpec, deliverySentence } from '@/lib/report-builder';
import { DEFAULT_ZONE, inZone } from '@/lib/time-zone';
import type { Delivery, Membership, MinistryConfig, MinistryData } from '@/lib/types/model';

export function serviceClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** A ministry, read as the server sees it. */
export function loadMinistry(db: SupabaseClient, orgId: string): Promise<MinistryData> {
  const m: Membership = { mode: 'supabase', persona: 'owner', role: 'owner', displayName: 'SquadRise', firstName: 'SquadRise', initials: 'SR', membershipId: null, orgId, teamId: null, studentName: null };
  return supabaseBackend(m, db).load();
}

export interface SendResult {
  delivery: string;
  period: string;
  status: 'sent' | 'skipped' | 'failed' | 'already';
  sent: number;
  missing: string[];
  error?: string;
}

const bare = (name: string) => name.replace(/ \(captain\)$/, '').trim();

/** What the job needs from the outside world — swapped out in tests. */
export interface Deps {
  db: SupabaseClient;
  load: (db: SupabaseClient, orgId: string) => Promise<MinistryData>;
  mail: typeof sendEmail;
  configured: boolean;
}
export const realDeps = (db: SupabaseClient): Deps => ({ db, load: loadMinistry, mail: sendEmail, configured: emailConfigured() });

/** Claim (delivery, period), then send each recipient their copy. */
export async function sendDelivery(deps: Deps, d: MinistryData, orgId: string, dl: Delivery, period: string, by: string, appUrl: string, now: number): Promise<SendResult> {
  const { db } = deps;
  const base: SendResult = { delivery: dl.id, period, status: 'sent', sent: 0, missing: [] };
  const claim = await db.from('report_sends').insert({ org_id: orgId, delivery_id: dl.id, period, by_name: by });
  if (claim.error) {
    if (claim.error.code === '23505') return { ...base, status: 'already' };
    throw new Error(claim.error.message);
  }
  const finish = async (r: SendResult) => {
    await db.from('report_sends').update({ status: r.status, sent: r.sent, missing: r.missing, error: r.error ?? null, sent_at: new Date().toISOString() }).eq('org_id', orgId).eq('delivery_id', dl.id).eq('period', period);
    return r;
  };
  try {
    const rep = reportSpec(d, dl.report);
    if (!rep) return finish({ ...base, status: 'skipped', error: 'The report this delivery sends no longer exists.' });
    if (!deps.configured) return finish({ ...base, status: 'skipped', error: 'Email isn’t set up on the server (RESEND_API_KEY and EMAIL_FROM).' });
    const groups = deliveryRecipientGroups(d, dl);
    const names = [...new Set(groups.flatMap((g) => g.names.map(bare)))];
    const found = await db.rpc('delivery_emails', { p_org: orgId, p_names: names });
    if (found.error) throw new Error(found.error.message);
    const emails = new Map(((found.data ?? []) as { name: string; email: string }[]).map((r) => [r.name.toLowerCase(), r.email]));
    const when = new Date(now).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const out = { ...base };
    for (const g of groups) {
      const team = g.team ? (d.teams.find((t) => t.id === g.team)?.name ?? null) : null;
      const result = runReport(d, scopedSpec(rep.spec, team));
      for (const name of new Set(g.names.map(bare))) {
        const to = emails.get(name.toLowerCase());
        if (!to) {
          out.missing.push(name);
          continue;
        }
        await deps.mail({ to, ...renderReport({ ministry: d.config.ministryName, report: rep.label, copy: g.label, when, result, appUrl, to }) });
        out.sent++;
      }
    }
    if (!out.sent && out.missing.length) out.error = 'Nobody on this delivery has an email on file.';
    return finish(out);
  } catch (e) {
    return finish({ ...base, status: 'failed', error: (e instanceof Error ? e.message : String(e)).slice(0, 500) });
  }
}

/** A moment on the ministry's own clock (see lib/time-zone). */
export const ministryNow = (config: Pick<MinistryConfig, 'timeZone'>, now: number) => inZone(now, config.timeZone || DEFAULT_ZONE);

/** Give up on a period this long after it was due: a cron that was down for
 *  a day shouldn't wake up and send yesterday's reports. */
const GRACE = 24 * 3600_000;

/** Every ministry's deliveries that are due now and haven't gone out. */
export async function runDueDeliveries(now: number, appUrl: string, given?: Deps) {
  const client = given?.db ?? serviceClient();
  if (!client) return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set.', results: [] };
  const deps = given ?? realDeps(client);
  const { db } = deps;
  const docs = await db.from('ministry_docs').select('org_id, value').eq('key', 'deliveries');
  if (docs.error) throw new Error(docs.error.message);
  const results: (SendResult & { org: string; label: string })[] = [];
  for (const row of (docs.data ?? []) as { org_id: string; value: Delivery[] }[]) {
    const list = (row.value ?? []).filter((dl) => dl.on);
    if (!list.length) continue;
    const org = await db.from('organizations').select('config').eq('id', row.org_id).single();
    const config = (org.data?.config ?? {}) as MinistryConfig;
    const local = ministryNow(config, now);
    const lite = { config: { ...config, meetingDates: config.meetingDates ?? [] } } as MinistryData;
    /* A night-close report needs the night itself (when it was closed), so
       only those ministries are loaded in full here; its time is a real
       moment, not a wall-clock one, so it's measured against the real now. */
    const full = list.some((dl) => dl.cadence === 'close') ? await deps.load(db, row.org_id) : null;
    const due = list
      .map((dl) => ({ dl, at: dl.cadence === 'close' ? (full ? deliveryDue(full, dl, now) : null) : deliveryDue(lite, dl, local) }))
      .filter((x): x is { dl: Delivery; at: { at: number; period: string } } => {
        if (!x.at) return false;
        const clock = x.dl.cadence === 'close' ? now : local;
        return clock >= x.at.at && clock - x.at.at < GRACE;
      });
    if (!due.length) continue;
    const sent = await db.from('report_sends').select('delivery_id, period').eq('org_id', row.org_id).in('period', [...new Set(due.map((x) => x.at.period))]);
    const done = new Set(((sent.data ?? []) as { delivery_id: string; period: string }[]).map((s) => s.delivery_id + '|' + s.period));
    const todo = due.filter((x) => !done.has(x.dl.id + '|' + x.at.period));
    if (!todo.length) continue;
    const d = full ?? (await deps.load(db, row.org_id));
    for (const { dl, at } of todo) {
      const r = await sendDelivery(deps, d, row.org_id, dl, at.period, 'Schedule', appUrl, now);
      results.push({ ...r, org: row.org_id, label: deliverySentence(d, dl) });
    }
  }
  return { results };
}
