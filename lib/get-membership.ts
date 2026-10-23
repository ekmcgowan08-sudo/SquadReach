import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DEMO_PEOPLE } from '@/lib/data/seed';
import { isSupabaseConfigured } from '@/lib/env';
import { supabaseServer } from '@/lib/supabase/server';
import { MEMBERSHIP_ROLES, isPersona, type MembershipRole, type Persona } from '@/lib/types/domain';
import type { Membership } from '@/lib/types/model';

/** Which of your approved roles you are using right now. In demo mode it is
 *  also the only thing that says who you are. */
export const ROLE_COOKIE = 'sr_role';

const RANK: MembershipRole[] = ['owner', 'leader', 'scorekeeper', 'coach', 'captain', 'member'];

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '··';

export function demoMembership(persona: Persona): Membership {
  const p = DEMO_PEOPLE[persona] ?? DEMO_PEOPLE.leader;
  return {
    mode: 'demo',
    persona,
    role: persona === 'parent' || persona === 'congregation' ? null : persona,
    displayName: p.displayName,
    firstName: p.firstName,
    initials: p.initials,
    membershipId: null,
    orgId: null,
    teamId: p.teamId,
    studentName: p.studentName
  };
}

export interface MembershipRow {
  id: string;
  org_id: string;
  role: MembershipRole;
  display_name: string;
  team_id: string | null;
  student_name: string | null;
}

/** The server's answer to "who is this, and as what?". Every dashboard route
 *  loads through it and redirects on a failed role check. */
export async function getCurrentMembership(): Promise<{ membership: Membership; roles: Persona[] } | null> {
  const jar = await cookies();
  const wanted = jar.get(ROLE_COOKIE)?.value;

  if (!isSupabaseConfigured()) {
    const persona = isPersona(wanted) ? wanted : 'leader';
    /* Every persona is pre-approved in demo mode so all eight are reachable. */
    return { membership: demoMembership(persona), roles: ['leader', 'owner', 'scorekeeper', 'coach', 'captain', 'member', 'parent', 'congregation'] };
  }

  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;
  const { data: rows } = await supabase
    .from('memberships')
    .select('id, org_id, role, display_name, team_id, student_name')
    .eq('user_id', user.id)
    .returns<MembershipRow[]>();
  if (!rows || !rows.length) return null;
  const sorted = rows.slice().sort((a, b) => RANK.indexOf(a.role) - RANK.indexOf(b.role));
  const row = sorted.find((r) => r.role === wanted) ?? sorted[0];
  const name = row.display_name || user.email || 'Friend';
  return {
    membership: {
      mode: 'supabase',
      persona: row.role,
      role: row.role,
      displayName: name,
      firstName: name.split(' ')[0],
      initials: initialsOf(name),
      membershipId: row.id,
      orgId: row.org_id,
      teamId: row.team_id,
      studentName: row.student_name
    },
    roles: sorted.filter((r) => r.org_id === row.org_id).map((r) => r.role).filter((r) => MEMBERSHIP_ROLES.includes(r))
  };
}

/** The signed-in Supabase user, or null (always null in demo mode). */
export async function getUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** For a page: who you are, or off to sign in / onboarding / back Home. The
 *  client screen checks the same gate again — a deep link is never the hole. */
export async function requireGate(gate?: (p: Persona) => boolean): Promise<Membership> {
  const res = await getCurrentMembership();
  if (!res) {
    if (!isSupabaseConfigured()) redirect('/dashboard');
    /* Signed in but in no ministry yet: create one or ask to join. */
    redirect((await getUser()) ? '/welcome' : '/login');
  }
  if (gate && !gate(res.membership.persona)) redirect('/dashboard?denied=1');
  return res.membership;
}
