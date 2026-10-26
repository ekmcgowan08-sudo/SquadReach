/* Every ministry's size as the pricing models read it: rostered students
   (guests left out), leaders with a login, and seasons saved in the last
   year. Read with the service role by the vendor admin only. */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface MinistrySize {
  id: string;
  name: string;
  students: number;
  leaders: number;
  /** Seasons saved in the last year; null when none are on file. */
  seasons: number | null;
  since: string;
}

/** Roles that hold a leader's seat under the per-seat model. */
const SEAT_ROLES = ['coach', 'scorekeeper', 'leader', 'owner'];

export async function ministrySizes(db: SupabaseClient, now = Date.now()): Promise<MinistrySize[]> {
  const [orgs, students, members, docs] = await Promise.all([
    db.from('organizations').select('id, name, config, created_at').order('created_at').limit(2000),
    db.from('students').select('org_id').eq('guest', false).limit(100000),
    db.from('memberships').select('org_id, user_id, role').in('role', SEAT_ROLES).limit(100000),
    db.from('ministry_docs').select('org_id, value').eq('key', 'seasons').limit(2000)
  ]);
  for (const r of [orgs, students, members, docs]) if (r.error) throw new Error(r.error.message);
  const count = new Map<string, number>();
  for (const s of (students.data ?? []) as { org_id: string }[]) count.set(s.org_id, (count.get(s.org_id) ?? 0) + 1);
  const seats = new Map<string, Set<string>>();
  for (const m of (members.data ?? []) as { org_id: string; user_id: string }[]) (seats.get(m.org_id) ?? seats.set(m.org_id, new Set()).get(m.org_id)!).add(m.user_id);
  const yearAgo = now - 365 * 86_400_000;
  const seasons = new Map<string, number>();
  for (const d of (docs.data ?? []) as { org_id: string; value: { savedAt?: number }[] }[]) {
    const n = Array.isArray(d.value) ? d.value.filter((s) => (s.savedAt ?? 0) >= yearAgo).length : 0;
    if (n) seasons.set(d.org_id, n);
  }
  return ((orgs.data ?? []) as { id: string; name: string; config: { ministryName?: string } | null; created_at: string }[]).map((o) => ({
    id: o.id,
    name: o.config?.ministryName || o.name,
    students: count.get(o.id) ?? 0,
    leaders: seats.get(o.id)?.size ?? 0,
    seasons: seasons.get(o.id) ?? null,
    since: o.created_at
  }));
}
