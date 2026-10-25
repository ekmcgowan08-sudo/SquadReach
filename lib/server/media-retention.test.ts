import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { expireFilm } from '@/lib/server/media-retention';

const NOW = Date.UTC(2026, 9, 25, 9);
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

function fake(failStorage = false) {
  const t: Record<string, Record<string, unknown>[]> = {
    organizations: [
      { id: 'a', config: { filmUpload: { on: true, maxMb: 80, keepDays: 30 } } },
      { id: 'b', config: {} }
    ],
    media_items: [
      { id: '1', org_id: 'a', kind: 'video', path: 'a/9/1', created_at: daysAgo(31) },
      { id: '2', org_id: 'a', kind: 'video', path: 'a/9/2', created_at: daysAgo(5) },
      { id: '3', org_id: 'a', kind: 'photo', path: 'a/9/3', created_at: daysAgo(400) },
      { id: '4', org_id: 'b', kind: 'video', path: 'b/2/4', created_at: daysAgo(61) },
      { id: '5', org_id: 'b', kind: 'video', path: 'b/2/5', created_at: daysAgo(59) }
    ]
  };
  const removed: string[] = [];
  const q = (table: string) => {
    const f: ((r: Record<string, unknown>) => boolean)[] = [];
    let del = false;
    const b = {
      select: () => b,
      eq: (c: string, v: unknown) => (f.push((r) => r[c] === v), b),
      lt: (c: string, v: string) => (f.push((r) => String(r[c]) < v), b),
      in: (c: string, v: unknown[]) => (f.push((r) => v.includes(r[c])), b),
      limit: () => b,
      delete: () => ((del = true), b),
      then: (ok: (v: unknown) => unknown) => {
        const rows = t[table].filter((r) => f.every((x) => x(r)));
        if (del) t[table] = t[table].filter((r) => !rows.includes(r));
        return Promise.resolve({ data: rows, error: null }).then(ok);
      }
    };
    return b;
  };
  const db = { from: q, storage: { from: () => ({ remove: async (p: string[]) => (failStorage ? { error: { message: 'storage is down' } } : (removed.push(...p), { error: null })) }) } } as unknown as SupabaseClient;
  return { db, t, removed };
}

describe('game film retention', () => {
  it('removes film past each ministry’s keep-for days, file and row, and leaves photos alone', async () => {
    const { db, t, removed } = fake();
    const out = await expireFilm(db, NOW);
    expect(removed.sort()).toEqual(['a/9/1', 'b/2/4']);
    expect(t.media_items.map((r) => r.id).sort()).toEqual(['2', '3', '5']);
    expect(out).toEqual([
      { org: 'a', removed: 1 },
      { org: 'b', removed: 1 }
    ]);
  });

  it('keeps the album rows when the files couldn’t be removed, so nothing leaks', async () => {
    const { db, t } = fake(true);
    const out = await expireFilm(db, NOW);
    expect(t.media_items).toHaveLength(5);
    expect(out[0]).toEqual({ org: 'a', removed: 0, error: 'storage is down' });
  });
});
