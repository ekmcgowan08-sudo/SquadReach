import { canEditRoster } from '@/lib/permissions';
import { pcoPeople } from '@/lib/server/pco';
import { pcoFail, pcoGate } from '@/lib/server/pco-route';

export const dynamic = 'force-dynamic';

/* People to import into the roster, from everyone or one list. Read only. */
export async function GET(req: Request) {
  const g = await pcoGate(canEditRoster, 'people who edit the roster import from Planning Center');
  if (g instanceof Response) return g;
  const list = new URL(req.url).searchParams.get('list') || undefined;
  try {
    return Response.json({ people: await pcoPeople(g.deps, g.m.orgId, list) });
  } catch (e) {
    return pcoFail(e);
  }
}
