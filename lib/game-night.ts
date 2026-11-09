/* The game, on the calendar: the next night it runs, named for the week
   and the game, with when (doors, from the run sheet) and where (the
   game's places, or its offsite address). Everyone sees when and where —
   the rules audience only decides who reads the rules. */
import { parseLocalISO } from '@/lib/dates';
import { ALL_AUDIENCES } from '@/lib/selectors';
import type { MinistryConfig, MinistryEvent, RunSheetItem } from '@/lib/types/model';

export const GAME_COLOR = '#0D9488';

/** The first meeting night from `today` on that's a game week. */
export function nextGameNight(c: Pick<MinistryConfig, 'meetingDates' | 'gameSetup'>, today: string): { iso: string; week: number } | null {
  const weeks = c.gameSetup.gameWeeks;
  const i = c.meetingDates.findIndex((iso, n) => iso >= today && (!weeks || weeks.includes(n + 1)));
  return i < 0 ? null : { iso: c.meetingDates[i], week: i + 1 };
}

const weekPrefix = (week: number) => 'Week ' + week + ' · ';

/** The night's own entry, when someone already put the week on the calendar. */
export function nightEntry(events: MinistryEvent[], night: { iso: string; week: number }): MinistryEvent | undefined {
  return events.find((e) => e.iso === night.iso && e.status !== 'proposed' && e.title.startsWith(weekPrefix(night.week)));
}

export function gameNightEvent(c: Pick<MinistryConfig, 'gameName' | 'gameSetup'>, sheet: RunSheetItem[], night: { iso: string; week: number }, id: string, by: string): MinistryEvent {
  const doors = sheet.find((it) => /^doors\b/i.test(it.label.trim()));
  const games = sheet.find((it) => /\bgames?\b/i.test(it.label));
  const time = (doors ?? games)?.time ?? '';
  const place = c.gameSetup.offsiteAddress.trim() || c.gameSetup.fieldTypes.join(' + ') || games?.where || '';
  const day = parseLocalISO(night.iso)!;
  return {
    id,
    title: weekPrefix(night.week) + (c.gameName.trim() || 'Game night'),
    meta: [day.toLocaleDateString('en-US', { weekday: 'short' }) + (time ? ' ' + time : ''), place].filter(Boolean).join(' · '),
    date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    iso: night.iso,
    time,
    place,
    color: GAME_COLOR,
    roles: [...ALL_AUDIENCES],
    status: 'approved',
    by
  };
}
