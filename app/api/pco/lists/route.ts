import { canEditRoster } from '@/lib/permissions';
import { pcoLists } from '@/lib/server/pco';
import { pcoFail, pcoGate } from '@/lib/server/pco-route';

export const dynamic = 'force-dynamic';

/* The church's Planning Center lists, to import from one of them. */
export async function GET() {
  const g = await pcoGate(canEditRoster, 'people who edit the roster import from Planning Center');
  if (g instanceof Response) return g;
  try {
    return Response.json({ lists: await pcoLists(g.deps, g.m.orgId) });
  } catch (e) {
    return pcoFail(e);
  }
}
