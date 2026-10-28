/* A phone that just caused a push asks for it to go now. It can't say what
   or to whom — the database queued that — only "send what's waiting for my
   ministry". The cron sends anything a phone didn't ask for. */
import { getCurrentMembership } from '@/lib/get-membership';
import { sendQueuedPushes } from '@/lib/server/push';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const res = await getCurrentMembership();
  const m = res?.membership;
  if (!m || m.mode !== 'supabase' || !m.orgId) return Response.json({ error: 'Sign in to a ministry first.' }, { status: 401 });
  const sending = sendQueuedPushes(req.url, m.orgId);
  if (!sending) return Response.json({ error: 'The server can’t push yet (SUPABASE_SERVICE_ROLE_KEY isn’t set).' }, { status: 503 });
  try {
    return Response.json(await sending);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
