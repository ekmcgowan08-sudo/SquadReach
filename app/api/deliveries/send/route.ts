/* "Send now" from the console, by email. Only a leader of the ministry may
   ask; the send itself is the same claimed, once-per-period path the
   schedule uses. Sending again in a period that already went out is
   recorded as its own send.

   `close`: the phone that closes the night sends its night-close reports
   straight away. Whoever may move the run sheet may close the night, so
   they may ask for these too — only these, once per night: a second ask
   for the same night sends nothing. */
import { getCurrentMembership } from '@/lib/get-membership';
import { canApprove, holdsSheet } from '@/lib/permissions';
import { deliveryDue } from '@/lib/report-builder';
import { ministryNow, realDeps, sendDelivery, serviceClient } from '@/lib/server/deliveries';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const res = await getCurrentMembership();
  const m = res?.membership;
  if (!m || m.mode !== 'supabase' || !m.orgId) return Response.json({ error: 'Sign in to a ministry first.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { id?: string; close?: boolean; period?: string };
  const close = body.close === true && typeof body.period === 'string' && /^c:\d{4}-\d{2}-\d{2}$/.test(body.period);
  if (!(close ? holdsSheet(m.persona) : canApprove(m.persona))) return Response.json({ error: 'Only leaders send reports.' }, { status: 403 });
  const db = serviceClient();
  if (!db) return Response.json({ error: 'The server can’t send reports yet (SUPABASE_SERVICE_ROLE_KEY isn’t set).' }, { status: 503 });
  const deps = realDeps(db);
  const d = await deps.load(db, m.orgId);
  const dl = d.deliveries.find((x) => x.id === body.id);
  if (!dl) return Response.json({ error: 'That delivery no longer exists.' }, { status: 404 });
  const now = Date.now();
  if (close) {
    /* The night named has to be one of the ministry's own nights. */
    if (dl.cadence !== 'close' || !d.config.meetingDates.includes(body.period!.slice(2))) return Response.json({ error: 'That isn’t a night-close report for one of your nights.' }, { status: 400 });
    return Response.json(await sendDelivery(deps, d, m.orgId, dl, body.period!, m.displayName, new URL('/dashboard/notifications', req.url).toString(), now));
  }
  const period = deliveryDue(d, dl, ministryNow(d.config, now))?.period ?? 'manual';
  const appUrl = new URL('/console?tab=reports', req.url).toString();
  let r = await sendDelivery(deps, d, m.orgId, dl, period, m.displayName, appUrl, now);
  if (r.status === 'already') r = await sendDelivery(deps, d, m.orgId, dl, period + '#' + now, m.displayName, appUrl, now);
  return Response.json(r);
}
