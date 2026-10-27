'use client';
/* A run sheet scheduled to publish itself goes out from whichever
   volunteer screen is open when it's due — the only clock the demo has.
   On Supabase the server's 15-minute cron publishes it too
   (lib/server/sheet-schedule); whichever comes first spends the
   schedule, so it goes out once. */
import { useEffect } from 'react';
import { canHuddle } from '@/lib/permissions';
import { publishSheet, scheduleDue } from '@/lib/sheet-schedule';
import { useApp, useAppApi } from '@/lib/store/provider';
import { useNow } from '@/lib/use-now';

export function SheetAutopublish() {
  const api = useAppApi();
  const schedule = useApp((s) => s.data.huddle.sheetSchedule);
  const night = useApp((s) => s.data.tonight.date);
  const tz = useApp((s) => s.data.config.timeZone);
  const persona = useApp((s) => s.membership.persona);
  const now = useNow(!!schedule, 30_000);
  useEffect(() => {
    if (!schedule || !canHuddle(persona) || !scheduleDue(schedule, night, now, tz)) return;
    const { huddle, told } = publishSheet(api().data.huddle, Date.now());
    api().mutate((d) => void (d.huddle = huddle));
    api().emit({ kind: 'huddle', huddle: api().data.huddle });
    api().logActivity('Published the run sheet on schedule — ' + told.length + ' assignment notice' + (told.length === 1 ? '' : 's') + (told.length ? ' (' + told.join(', ') + ')' : ''));
  }, [schedule, night, now, tz, persona, api]);
  return null;
}
