/* Notifications → "Send a test": a real push, through the push service, to
   the asker's own phones — so a leader knows the phone will show one before
   relying on it on a Wednesday night. */
import { isSupabaseConfigured } from '@/lib/env';
import { PUSH_TEST } from '@/lib/push';
import { serviceClient } from '@/lib/server/deliveries';
import { dbStore, pushConfigured, pushToUser, vapidSubject, webPushSender } from '@/lib/server/push';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const db = serviceClient();
  if (!db || !pushConfigured()) return Response.json({ error: 'Push isn’t set up on this server yet.' }, { status: 503 });
  try {
    return Response.json(await pushToUser(dbStore(db), webPushSender(vapidSubject(req.url)), data.user.id, PUSH_TEST));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
