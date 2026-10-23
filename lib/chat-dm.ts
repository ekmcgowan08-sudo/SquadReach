/* Direct messages with accounts. A thread is 'dm:<membership>:<membership>'
   (smaller id first) and the database decides who reads it: the two people,
   plus every leader when one of them is a student ("open door"). This turns
   a thread id into the thread a given person sees. */
import { personaDef, type MembershipRole, type Persona } from '@/lib/types/domain';
import type { ChatThread, Membership } from '@/lib/types/model';

export interface DirectoryEntry {
  id: string;
  name: string;
  role: MembershipRole;
  teamId: string | null;
}

const ALL: Persona[] = ['leader', 'owner', 'scorekeeper', 'coach', 'captain', 'member'];
const STUDENT: MembershipRole[] = ['member', 'captain'];

export const dmThreadId = (a: string, b: string) => 'dm:' + [a, b].sort().join(':');

export function dmThread(id: string, directory: DirectoryEntry[], me: Membership, names?: Map<string, string>): ChatThread | null {
  const m = /^dm:([0-9a-f-]{36}):([0-9a-f-]{36})$/.exec(id);
  if (!m) return null;
  const [a, b] = [m[1], m[2]];
  const who = (x: string) => directory.find((p) => p.id === x);
  const nameOf = (x: string) => who(x)?.name ?? names?.get(x) ?? 'Someone';
  const mine = me.membershipId === a || me.membershipId === b;
  const other = me.membershipId === a ? b : a;
  const student = [a, b].some((x) => STUDENT.includes(who(x)?.role ?? 'coach'));
  const role = who(other)?.role;
  return {
    id,
    kind: 'dm',
    name: mine ? nameOf(other) : nameOf(a) + ' ↔ ' + nameOf(b),
    sub: mine ? (role ? personaDef(role).label : 'Direct message') + (student ? ' · open door' : '') : 'Open door · leaders can read, not post',
    tint: student ? '#1d4f4a' : '#26404d',
    read: ALL,
    post: mine ? ALL : []
  };
}
