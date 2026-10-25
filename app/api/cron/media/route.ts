/* Daily: game film past its keep-for days leaves the album. Same secret as
   the report schedule. */
import { serviceClient } from '@/lib/server/deliveries';
import { expireFilm } from '@/lib/server/media-retention';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'CRON_SECRET is not set.' }, { status: 503 });
  if (req.headers.get('authorization') !== 'Bearer ' + secret) return new Response('Unauthorized', { status: 401 });
  const db = serviceClient();
  if (!db) return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set.' }, { status: 503 });
  return Response.json({ results: await expireFilm(db, Date.now()) });
}
