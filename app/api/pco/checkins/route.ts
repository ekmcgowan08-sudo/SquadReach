import { canEditRoster } from '@/lib/permissions';
import { pcoCheckIns } from '@/lib/server/pco';
import { pcoFail, pcoGate } from '@/lib/server/pco-route';

export const dynamic = 'force-dynamic';

/* Who checked in through Planning Center Check-Ins between two instants
   (the phone sends the night's window in the ministry's own time). */
export async function GET(req: Request) {
  const g = await pcoGate(canEditRoster, 'people who take attendance pull check-ins');
  if (g instanceof Response) return g;
  const q = new URL(req.url).searchParams;
  const from = q.get('from');
  const to = q.get('to');
  if (!from || !to || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to)) || Date.parse(to) - Date.parse(from) > 36 * 3600_000) {
    return Response.json({ error: 'Ask for one night: from and to, at most a day and a half apart.' }, { status: 400 });
  }
  try {
    return Response.json({ names: await pcoCheckIns(g.deps, g.m.orgId, from, to) });
  } catch (e) {
    return pcoFail(e);
  }
}
