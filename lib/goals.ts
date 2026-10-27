/* Goals, assists and MVPs. Nothing here is stored: a goal is a Games
   entry in the ledger with the scorer as its student and detail.goal, an
   MVP one with detail.mvp, so a game's score and every player's stats are
   read back from the ledger like everything else. A reversed or
   withdrawn entry stops counting. */
import type { LedgerEntry } from '@/lib/types/model';

const live = (entries: LedgerEntry[]) => {
  const reversed = new Set(entries.map((e) => e.reverses).filter(Boolean) as string[]);
  return entries.filter((e) => !e.reverses && !reversed.has(e.id) && e.status !== 'rejected');
};

/** This game's goals by squad (since goal scoring was turned on), newest first. */
export function gameGoals(entries: LedgerEntry[], since: number) {
  const list = live(entries)
    .filter((e) => e.detail?.goal && e.at >= since)
    .sort((a, b) => b.at - a.at);
  const byTeam: Record<string, number> = {};
  for (const e of list) byTeam[e.team] = (byTeam[e.team] ?? 0) + 1;
  return { list, byTeam };
}

/** This game's MVP, if one was named. */
export const gameMvp = (entries: LedgerEntry[], since: number) =>
  live(entries)
    .filter((e) => e.detail?.mvp && e.at >= since)
    .sort((a, b) => b.at - a.at)[0] ?? null;

export interface PlayerLine {
  name: string;
  team: string;
  goals: number;
  assists: number;
  mvp: number;
}

/** Every player with a goal, an assist or an MVP, best first. */
export function playerStats(entries: LedgerEntry[], teamOf: (name: string) => string = () => ''): PlayerLine[] {
  const by = new Map<string, PlayerLine>();
  const line = (name: string, team: string) => {
    if (!by.has(name)) by.set(name, { name, team: teamOf(name) || team, goals: 0, assists: 0, mvp: 0 });
    return by.get(name)!;
  };
  for (const e of live(entries)) {
    if (e.detail?.goal) {
      if (e.student) line(e.student, e.team).goals++;
      if (e.detail.goal.assist) line(e.detail.goal.assist, e.team).assists++;
    }
    if (e.detail?.mvp && e.student) line(e.student, e.team).mvp++;
  }
  return [...by.values()].sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.mvp - a.mvp || a.name.localeCompare(b.name));
}
