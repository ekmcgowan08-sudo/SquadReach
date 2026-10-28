/* The delivery schedule's clock. Call it every 15 minutes or so (vercel.json
   does, on Vercel) with `Authorization: Bearer $CRON_SECRET`. Each due
   (delivery, period) is sent once, however often this runs; so is each
   run sheet scheduled to publish itself. Then it sends any pushes still
   queued — the ones those publishes made, and any a phone didn't ask for. */
import { runDueDeliveries, serviceClient } from '@/lib/server/deliveries';
import { sendQueuedPushes } from '@/lib/server/push';
import { runDueSheets } from '@/lib/server/sheet-schedule';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'CRON_SECRET is not set, so the schedule can’t be triggered.' }, { status: 503 });
  if (req.headers.get('authorization') !== 'Bearer ' + secret) return new Response('Unauthorized', { status: 401 });
  const out = await runDueDeliveries(Date.now(), new URL('/console?tab=reports', req.url).toString());
  /* The same clock publishes run sheets scheduled to go out on their own. */
  const db = serviceClient();
  const sheets = db ? await runDueSheets(db, Date.now()) : [];
  const pushes = await sendQueuedPushes(req.url)?.catch((e: Error) => ({ error: e.message }));
  return Response.json({ ...out, sheets, pushes: pushes ?? null }, { status: out.error ? 503 : 200 });
}
