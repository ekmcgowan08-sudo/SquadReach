import { canApprove } from '@/lib/permissions';
import { disconnect } from '@/lib/server/pco';
import { pcoFail, pcoGate } from '@/lib/server/pco-route';

export const dynamic = 'force-dynamic';

/* Forgets the connection's tokens. Planning Center itself is untouched. */
export async function POST() {
  const g = await pcoGate(canApprove, 'leaders disconnect Planning Center');
  if (g instanceof Response) return g;
  try {
    await disconnect(g.deps, g.m.orgId);
    return Response.json({ ok: true });
  } catch (e) {
    return pcoFail(e);
  }
}
