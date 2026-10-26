/* Planning Center sends the leader back here with a code. The state must
   match the one set when they left, for the same ministry they're in now. */
import { NextResponse, type NextRequest } from 'next/server';
import { canApprove } from '@/lib/permissions';
import { connect } from '@/lib/server/pco';
import { STATE_COOKIE, pcoGate } from '@/lib/server/pco-route';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const back = (outcome: string, why?: string) => {
    const to = new URL('/console', url.origin);
    to.searchParams.set('tab', 'people');
    to.searchParams.set('pco', outcome);
    if (why) to.searchParams.set('why', why.slice(0, 200));
    const res = NextResponse.redirect(to);
    res.cookies.delete({ name: STATE_COOKIE, path: '/api/pco' });
    return res;
  };
  const g = await pcoGate(canApprove, 'leaders connect Planning Center');
  if (g instanceof Response) return back('unavailable');
  const [state, org] = (req.cookies.get(STATE_COOKIE)?.value ?? '').split('.');
  if (url.searchParams.get('error')) return back('declined');
  const code = url.searchParams.get('code');
  if (!code || !state || url.searchParams.get('state') !== state || org !== g.m.orgId) return back('error', 'That sign-in didn’t start here, or took too long. Try connecting again.');
  try {
    await connect(g.deps, g.m.orgId, code, url.origin + '/api/pco/callback', g.m.membershipId);
    return back('connected');
  } catch (e) {
    return back('error', e instanceof Error ? e.message : undefined);
  }
}
