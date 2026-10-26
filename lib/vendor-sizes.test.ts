import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ministrySizes } from '@/lib/vendor-sizes';

type Row = Record<string, unknown>;
/* Just enough of supabase-js: select, eq, in, order, limit, then. */
function fakeDb(tables: Record<string, Row[]>) {
  return {
    from: (table: string) => {
      const filters: ((r: Row) => boolean)[] = [];
      const b = {
        select: () => b,
        eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
        in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), b),
        order: () => b,
        limit: () => b,
        then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: (tables[table] ?? []).filter((r) => filters.every((f) => f(r))), error: null }).then(ok)
      };
      return b;
    }
  } as unknown as SupabaseClient;
}

const NOW = Date.UTC(2026, 9, 26);
const DAY = 86_400_000;

describe('ministry sizes for pricing', () => {
  it('counts rostered students, leaders with a login once each, and this year’s seasons', async () => {
    const db = fakeDb({
      organizations: [
        { id: 'a', name: 'grace-org', config: { ministryName: 'Grace Community Students' }, created_at: '2026-01-01' },
        { id: 'b', name: 'Ridge Youth', config: null, created_at: '2026-02-01' }
      ],
      students: [
        { org_id: 'a', guest: false }, { org_id: 'a', guest: false }, { org_id: 'a', guest: true }, { org_id: 'b', guest: false }
      ],
      memberships: [
        { org_id: 'a', user_id: 'u1', role: 'owner' }, { org_id: 'a', user_id: 'u1', role: 'leader' }, { org_id: 'a', user_id: 'u2', role: 'coach' },
        { org_id: 'a', user_id: 'u3', role: 'member' }, { org_id: 'a', user_id: 'u4', role: 'captain' }, { org_id: 'b', user_id: 'u9', role: 'scorekeeper' }
      ],
      ministry_docs: [
        { org_id: 'a', key: 'seasons', value: [{ savedAt: NOW - 30 * DAY }, { savedAt: NOW - 200 * DAY }, { savedAt: NOW - 500 * DAY }] },
        { org_id: 'b', key: 'seasons', value: [{ savedAt: NOW - 400 * DAY }] }
      ]
    });
    const out = await ministrySizes(db, NOW);
    expect(out).toEqual([
      { id: 'a', name: 'Grace Community Students', students: 2, leaders: 2, seasons: 2, since: '2026-01-01' },
      { id: 'b', name: 'Ridge Youth', students: 1, leaders: 1, seasons: null, since: '2026-02-01' }
    ]);
  });
});
