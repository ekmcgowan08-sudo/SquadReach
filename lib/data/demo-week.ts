/* The demo's week 9 is always the coming Wednesday. The seed is written for
   one real night (DEMO_NIGHT); every date in it moves forward by whole weeks
   so a Wednesday stays a Wednesday and the demo never goes stale — opened
   any day, it's the week before a night, as the walkthrough expects. A
   Wednesday counts until noon; after that the demo looks ahead to the next. */
import { isoDay, parseLocalISO } from '@/lib/dates';
import type { MinistryData } from '@/lib/types/model';

export const DEMO_NIGHT = '2026-10-28';

const DAY = 86_400_000;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const utcDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

export function addDays(iso: string, days: number): string {
  const d = parseLocalISO(iso)!;
  d.setDate(d.getDate() + days);
  return isoDay(d);
}

/** The night the demo should be the week of, as of `now`. */
export function demoNightFor(now: number): string {
  const at = new Date(now);
  const today = isoDay(at);
  let weeks = Math.max(0, Math.ceil((utcDay(today) - utcDay(DEMO_NIGHT)) / (7 * DAY)));
  if (addDays(DEMO_NIGHT, weeks * 7) === today && at.getHours() >= 12) weeks++;
  return addDays(DEMO_NIGHT, weeks * 7);
}

/** Every calendar date in it, moved by `days`. Ministry data is plain JSON
 *  (it's what the demo keeps in localStorage), dates are ISO strings —
 *  values and keys alike (nights, gatherings) — and times are numbers that
 *  are already relative to now, so a text pass moves exactly the dates. */
export function shiftDates<T>(data: T, days: number): T {
  if (!days) return data;
  return JSON.parse(JSON.stringify(data).replace(/(?<!\d)(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])(?!\d)/g, (iso) => addDays(iso, days))) as T;
}

const label = (iso: string) => {
  const d = parseLocalISO(iso)!;
  return MON[d.getMonth()] + ' ' + d.getDate();
};

/** The demo moved from the night it was on to `to`: dates shifted, and the
 *  words written from them rewritten to match. */
export function moveDemo(d: MinistryData, from: string, to: string): MinistryData {
  const days = Math.round((utcDay(to) - utcDay(from)) / DAY);
  if (!days) return d;
  const out = shiftDates(d, days);
  for (const e of out.events) if (e.iso) e.date = label(e.iso);
  const retreat = out.events.find((e) => e.id === 'e5');
  const waiver = out.slips.find((s) => s.id === 'retreat');
  if (retreat?.iso && waiver) {
    const end = addDays(retreat.iso, 2);
    const same = parseLocalISO(end)!.getMonth() === parseLocalISO(retreat.iso)!.getMonth();
    waiver.title = 'Fall retreat · ' + label(retreat.iso) + '–' + (same ? String(parseLocalISO(end)!.getDate()) : label(end));
  }
  return out;
}
