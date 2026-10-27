import 'server-only';
/* Game film leaves the album after the ministry's chosen number of days
   (Console › Media › Game film): the storage object and its album row both
   go. Photos are never touched. Runs daily from app/api/cron/media. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { FILM_DEFAULTS, type MinistryConfig } from '@/lib/types/model';

const DAY = 86_400_000;

export async function expireFilm(db: SupabaseClient, now: number) {
  const orgs = await db.from('organizations').select('id, config');
  if (orgs.error) throw new Error(orgs.error.message);
  const out: { org: string; removed: number; error?: string }[] = [];
  for (const o of (orgs.data ?? []) as { id: string; config: Partial<MinistryConfig> | null }[]) {
    const keep = Math.max(1, o.config?.filmUpload?.keepDays ?? FILM_DEFAULTS.keepDays);
    const cutoff = new Date(now - keep * DAY).toISOString();
    const old = await db.from('media_items').select('id, path').eq('org_id', o.id).eq('kind', 'video').lt('created_at', cutoff).limit(1000);
    if (old.error) {
      out.push({ org: o.id, removed: 0, error: old.error.message });
      continue;
    }
    const rows = (old.data ?? []) as { id: string; path: string | null }[];
    if (!rows.length) continue;
    const paths = rows.map((r) => r.path).filter((p): p is string => !!p);
    /* Files first: a row without its file is harmless; a file without its
       row is a leak nobody can see. Rows go only once their files have. */
    let failed: string | null = null;
    for (let i = 0; i < paths.length && !failed; i += 100) {
      const rm = await db.storage.from('media').remove(paths.slice(i, i + 100));
      if (rm.error) failed = rm.error.message;
    }
    if (failed) {
      out.push({ org: o.id, removed: 0, error: failed });
      continue;
    }
    const del = await db.from('media_items').delete().in('id', rows.map((r) => r.id));
    out.push({ org: o.id, removed: rows.length, ...(del.error ? { error: del.error.message } : {}) });
  }
  return out;
}
