/* Publishing the run sheet on a schedule: "the day before at 4:00 PM".
   The sheet as it stands at that moment is what goes out — each owner
   not yet told is told, exactly as if a leader had pressed Publish. The
   moment is the ministry's wall clock (lib/time-zone), so the server's
   cron and a leader's open console agree on when it's due. */
import { isoDay, parseLocalISO } from '@/lib/dates';
import { DEFAULT_ZONE, inZone } from '@/lib/time-zone';
import type { HuddleState } from '@/lib/types/model';

export type SheetSchedule = NonNullable<HuddleState['sheetSchedule']>;

/** The local "YYYY-MM-DDTHH:MM" the sheet goes out. */
export function scheduleAt(s: SheetSchedule, nightIso: string): string | null {
  const night = parseLocalISO(nightIso);
  if (!night || !/^\d{2}:\d{2}$/.test(s.time)) return null;
  night.setDate(night.getDate() - Math.max(0, s.daysBefore));
  return isoDay(night) + 'T' + s.time;
}

/** Due once the ministry's own clock has passed the scheduled moment. */
export function scheduleDue(s: SheetSchedule | null | undefined, nightIso: string, now: number, tz?: string): boolean {
  if (!s || !nightIso) return false;
  const at = scheduleAt(s, nightIso);
  if (!at) return false;
  const local = new Date(inZone(now, tz || DEFAULT_ZONE));
  const stamp = isoDay(local) + 'T' + String(local.getHours()).padStart(2, '0') + ':' + String(local.getMinutes()).padStart(2, '0');
  return stamp >= at;
}

/** "Goes out Tuesday, the day before, at 4:00 PM." */
export function scheduleSentence(s: SheetSchedule, nightIso: string): string {
  const at = scheduleAt(s, nightIso);
  if (!at) return 'Not scheduled';
  const [day, time] = at.split('T');
  const [h, m] = time.split(':').map(Number);
  const clock = ((h + 11) % 12) + 1 + ':' + String(m).padStart(2, '0') + (h < 12 ? ' AM' : ' PM');
  const weekday = parseLocalISO(day)!.toLocaleDateString('en-US', { weekday: 'long' });
  const when = s.daysBefore === 0 ? 'the day of the night' : s.daysBefore === 1 ? 'the day before' : s.daysBefore + ' days before';
  return 'Goes out ' + weekday + ', ' + when + ', at ' + clock;
}

/** Publish: every owner not yet told is told now; the schedule is spent. */
export function publishSheet(h: HuddleState, at: number): { huddle: HuddleState; told: string[] } {
  const told: string[] = [];
  const runSheet = h.runSheet.map((it) => {
    if (!it.assignedTo || it.notifiedAt) return it;
    const who = h.crew.find((c) => c.id === it.assignedTo)?.name;
    if (who) told.push(who);
    return { ...it, notifiedAt: at };
  });
  return { huddle: { ...h, runSheet, sheetDirty: false, sheetSchedule: null }, told };
}
