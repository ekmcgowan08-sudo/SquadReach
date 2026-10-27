import 'server-only';
/* The run sheet's scheduled publish, for ministries on Supabase: run from
   the same 15-minute cron as the delivery schedule. A due sheet is
   published exactly as a leader's Publish would — owners not yet told are
   told — and the schedule is spent, so running twice does nothing. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isoDay } from '@/lib/dates';
import { publishSheet, scheduleDue } from '@/lib/sheet-schedule';
import type { HuddleState, MinistryConfig } from '@/lib/types/model';

export async function runDueSheets(db: SupabaseClient, now: number) {
  const since = isoDay(new Date(now - 2 * 86_400_000));
  const rows = await db.from('nights').select('org_id, meeting_date, huddle').gte('meeting_date', since).not('huddle->sheetSchedule', 'is', null);
  if (rows.error) throw new Error(rows.error.message);
  const results: { org: string; night: string; told: number }[] = [];
  for (const row of (rows.data ?? []) as { org_id: string; meeting_date: string; huddle: HuddleState }[]) {
    const h = row.huddle;
    if (!h?.sheetSchedule || !Array.isArray(h.runSheet)) continue;
    const org = await db.from('organizations').select('config').eq('id', row.org_id).single();
    const tz = (org.data?.config as Partial<MinistryConfig> | undefined)?.timeZone;
    if (!scheduleDue(h.sheetSchedule, row.meeting_date, now, tz)) continue;
    const { huddle, told } = publishSheet(h, now);
    const up = await db.from('nights').update({ huddle, updated_at: new Date(now).toISOString() }).eq('org_id', row.org_id).eq('meeting_date', row.meeting_date);
    if (up.error) throw new Error(up.error.message);
    await db.from('activity_log').insert({ org_id: row.org_id, actor: null, line: 'Published the run sheet on schedule — ' + told.length + ' assignment notice' + (told.length === 1 ? '' : 's') + (told.length ? ' (' + told.join(', ') + ')' : '') });
    results.push({ org: row.org_id, night: row.meeting_date, told: told.length });
  }
  return results;
}
