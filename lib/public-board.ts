/* What the public parent board shows. In Supabase mode it comes from the
   public_board() function; in demo mode it is computed the same way from
   this browser's demo data. Either way: no full names. */
import { verseForWeek } from '@/lib/bible';
import { standings, studentRanks } from '@/lib/scoring';
import type { MemoryVerse, MinistryData } from '@/lib/types/model';

export interface PublicBoardData {
  ministry: string;
  week: number;
  seasonWeeks: number;
  standings?: { name: string; color: string; total: number }[];
  mvp?: { name: string; color: string; total: number }[];
  verse?: MemoryVerse | null;
  events?: { title: string; meta: string; day: string | null; color: string }[];
}

export function boardFromMinistry(d: MinistryData, today: string): PublicBoardData {
  const s = d.config.parentShare;
  const out: PublicBoardData = { ministry: d.config.ministryName, week: d.config.weekNumber, seasonWeeks: d.config.seasonWeeks };
  if (s.standings) out.standings = standings(d.teams, d.cats, d.ledger).map((t) => ({ name: t.name, color: t.color, total: t.total }));
  if (s.mvp)
    out.mvp = studentRanks(d.roster, d.ledger, d.studentSeedPoints)
      .slice(0, 5)
      .map((r) => ({ name: r.name.split(' ')[0], color: d.teams.find((t) => t.id === r.team)?.color ?? '#968ae0', total: r.total }));
  if (s.verse) out.verse = verseForWeek(d.config.memoryVerses, d.config.weekNumber);
  if (s.calendar)
    out.events = d.events
      .filter((e) => e.status !== 'proposed' && e.roles.includes('parents') && (!e.iso || e.iso >= today))
      .map((e) => ({ title: e.title, meta: e.meta, day: e.iso ?? null, color: e.color }));
  return out;
}
