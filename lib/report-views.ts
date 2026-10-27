/* The season at a glance (Console › Reports): what each week looked like,
   read from the same data as everything else. Weeks run from one meeting
   night to the next; only weeks that have started are counted. */
import { isoDay } from '@/lib/dates';
import { teamTotal } from '@/lib/scoring';
import type { MinistryData } from '@/lib/types/model';

export interface WeekValue {
  week: number;
  date: string;
  value: number;
}

const started = (d: MinistryData, today: string) => d.config.meetingDates.slice().sort().filter((iso) => iso <= today);

/** Share of the roster here each night, across every squad (roster-weighted). */
export function attendanceByWeek(d: MinistryData, today: string): WeekValue[] {
  return started(d, today).map((date, i) => {
    let here = 0;
    let all = 0;
    for (const t of d.teams) {
      const roster = d.roster.filter((r) => r.team === t.id && !r.guest).length;
      here += ((d.attendanceHistory[t.id]?.[i] ?? 0) / 100) * roster;
      all += roster;
    }
    return { week: i + 1, date, value: all ? Math.round((here / all) * 100) : 0 };
  });
}

/** How many people practiced Bible reading at least once in each week. */
export function bibleByWeek(d: MinistryData, today: string): WeekValue[] {
  const dates = started(d, today);
  return dates.map((date, i) => {
    const next = d.config.meetingDates.slice().sort()[i + 1];
    const who = new Set(d.practiceLog.filter((p) => p.day >= date && (!next || p.day < next)).map((p) => p.who));
    return { week: i + 1, date, value: who.size };
  });
}

/** Each squad's running total at the end of each week. */
export function squadTrends(d: MinistryData, today: string): { team: string; weeks: WeekValue[] }[] {
  const all = d.config.meetingDates.slice().sort();
  const dates = started(d, today);
  return d.teams.map((t) => ({
    team: t.id,
    weeks: dates.map((date, i) => {
      const next = all[i + 1];
      const upTo = d.ledger.filter((e) => !next || isoDay(new Date(e.at)) < next);
      return { week: i + 1, date, value: teamTotal(upTo, t.id) };
    })
  }));
}
