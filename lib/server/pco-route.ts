import 'server-only';
/* The checks every Planning Center route makes before it touches the
   connection: a signed-in member of a live ministry, in a role allowed to do
   this, on a server that has Planning Center and the service key set up. */
import { getCurrentMembership } from '@/lib/get-membership';
import { realPcoDeps, PcoError, type PcoDeps } from '@/lib/server/pco';
import type { Persona } from '@/lib/types/domain';
import type { Membership } from '@/lib/types/model';

export async function pcoGate(allowed: (p: Persona) => boolean, what: string): Promise<{ m: Membership & { orgId: string }; deps: PcoDeps } | Response> {
  const res = await getCurrentMembership();
  const m = res?.membership;
  if (!m || m.mode !== 'supabase' || !m.orgId) return Response.json({ error: 'Sign in to a ministry first.' }, { status: 401 });
  if (!allowed(m.persona)) return Response.json({ error: 'Only ' + what + '.' }, { status: 403 });
  const deps = realPcoDeps();
  if (!deps) return Response.json({ error: 'Planning Center isn’t set up on this server (PCO_CLIENT_ID, PCO_CLIENT_SECRET and SUPABASE_SERVICE_ROLE_KEY).' }, { status: 503 });
  return { m: m as Membership & { orgId: string }, deps };
}

/** A Planning Center failure, as the console shows it. */
export const pcoFail = (e: unknown) => Response.json({ error: e instanceof Error ? e.message : 'Planning Center didn’t answer.' }, { status: e instanceof PcoError ? e.status : 502 });

export const STATE_COOKIE = 'sr_pco_state';
