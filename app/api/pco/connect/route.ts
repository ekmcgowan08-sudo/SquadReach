/* Starts connecting Planning Center: a leader is sent to Planning Center to
   approve read access to people and check-ins, with a one-time state that
   the callback checks, so nobody can finish a connection they didn't start. */
import { NextResponse } from 'next/server';
import { canApprove } from '@/lib/permissions';
import { authorizeUrl } from '@/lib/server/pco';
import { STATE_COOKIE, pcoGate } from '@/lib/server/pco-route';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const g = await pcoGate(canApprove, 'leaders connect Planning Center');
  if (g instanceof Response) return NextResponse.redirect(new URL('/console?tab=people&pco=unavailable', req.url));
  const state = crypto.randomUUID();
  const origin = new URL(req.url).origin;
  const res = NextResponse.redirect(authorizeUrl(g.deps.clientId, origin + '/api/pco/callback', state));
  res.cookies.set(STATE_COOKIE, state + '.' + g.m.orgId, { httpOnly: true, sameSite: 'lax', secure: origin.startsWith('https'), path: '/api/pco', maxAge: 600 });
  return res;
}
