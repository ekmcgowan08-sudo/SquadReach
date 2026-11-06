/* Who reads a prayer request (the design's rule, kept in production): the
   leader it's assigned to, and nobody else until it's on the wall. Other
   leaders see that it exists, who sent it and who has it. With Supabase the
   database decides and the phone only shows; the demo plays the same rule
   by name. */
import { DEMO_PEOPLE } from '@/lib/data/seed';
import type { Membership, MinistryData, PrayerQueued } from '@/lib/types/model';

/** Yours to read, post or hold. */
export const prayerMine = (q: PrayerQueued, m: Membership) => (m.mode === 'supabase' ? !!q.mine : !!q.owner && q.owner === m.displayName);

/** What it says is on this phone for this person. */
export const prayerReadable = (q: PrayerQueued, m: Membership) => (m.mode === 'supabase' ? !q.sealed : prayerMine(q, m));

/** Whether this person may take it now: nobody has it, or it's an owner
 *  taking it over. */
export const prayerTakeable = (q: PrayerQueued, m: Membership) => !prayerMine(q, m) && (!q.owner || m.persona === 'owner');

/** The ministry's leaders, as someone could hand a request to them. */
export function prayerLeaders(d: MinistryData, m: Membership): { id: string; name: string }[] {
  if (m.mode === 'supabase') return (d.people ?? []).filter((p) => p.role === 'leader' || p.role === 'owner').map((p) => ({ id: p.id, name: p.name }));
  return [DEMO_PEOPLE.leader, DEMO_PEOPLE.owner].map((p) => ({ id: p.displayName, name: p.displayName }));
}
