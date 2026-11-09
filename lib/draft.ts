/* Draft day: squads take turns picking from the students who have no
   squad yet. Snake reverses the order every other round, so the squad
   that picks last in one round picks first in the next. */
import type { Student } from '@/lib/types/model';

export interface DraftSettings {
  style: 'snake' | 'straight';
  /** How many times each squad picks. */
  rounds: number;
  /** Squad ids, first pick first. */
  order: string[];
  /** After the student rounds, how many times each squad picks a coach. */
  coachRounds?: number;
  /** While a draft is running: how many picks have been made, and the coach
   *  rounds it runs (none when no coach was waiting for a squad at the start). */
  live: { pick: number; startedAt: number; coachRounds?: number } | null;
  /** The latest draft's picks, in order — kept after it ends for the recap. */
  picks?: DraftPick[];
  /** Dynasty: squads carry over into the next season instead of a new draft. */
  dynasty?: boolean;
}

export interface DraftPick {
  kind: 'student' | 'coach';
  round: number;
  team: string;
  name: string;
}

export interface TradeRecord {
  id: string;
  at: number;
  by: string;
  moves: { student: string; from: string | null; to: string }[];
}

export const DRAFT_DEFAULTS = (teams: string[]): DraftSettings => ({ style: 'snake', rounds: 3, coachRounds: 1, order: teams, live: null });

/** How students land on squads when a new season goes live — the season
 *  builder's "How do students end up on a squad?". */
export type SquadCarry = 'keep' | 'draft' | 'random' | 'pastor';

/** The season's own answer, or, where the builder was left at its default,
 *  what Draft & trades says: dynasty, a new draft every season, or — never
 *  set — squads left for the pastor to arrange. */
export function squadCarry(answer: string | undefined, dynasty: boolean | undefined): SquadCarry {
  if (answer === 'keep' || answer === 'draft' || answer === 'random' || answer === 'pastor') return answer;
  return dynasty === true ? 'keep' : dynasty === false ? 'draft' : 'pastor';
}

export const CARRY_LINE: Record<SquadCarry, string> = {
  keep: 'Squads carry over as they are — rivalries and all.',
  draft: 'Every student goes back into the draft pool for draft night, captains too.',
  random: 'Students are dealt onto squads at random, balanced by grade.',
  pastor: 'Squads stay as they are for you to rebalance by hand.'
};

/** The students whose squad changes as a season goes live, as they'll be.
 *  A redraft empties every squad; dealing goes grade by grade around the
 *  squads, carrying on from where the last grade stopped, so squads come
 *  out level overall and within each grade. */
export function carrySquads(roster: Student[], teams: string[], how: SquadCarry, rand: () => number = Math.random): Student[] {
  if (how === 'draft') return roster.filter((s) => s.team || s.captain).map((s) => ({ ...s, team: null, captain: false }));
  if (how !== 'random' || !teams.length) return [];
  const byGrade = new Map<string, Student[]>();
  for (const s of roster) byGrade.set(s.grade, [...(byGrade.get(s.grade) ?? []), s]);
  const grades = [...byGrade.keys()].sort((a, b) => (Number(a) || 99) - (Number(b) || 99));
  const order = teams.map((t, i) => ({ t, k: rand(), i })).sort((a, b) => a.k - b.k || a.i - b.i).map((x) => x.t);
  const out: Student[] = [];
  let turn = 0;
  for (const g of grades) {
    const kids = byGrade.get(g)!.map((s) => ({ s, k: rand() })).sort((a, b) => a.k - b.k).map((x) => x.s);
    for (const s of kids) {
      const team = order[turn++ % order.length];
      if (s.team !== team || s.captain) out.push({ ...s, team, captain: false });
    }
  }
  return out;
}

/** Every pick of the draft in order: the squad id making it. */
export function draftSequence(s: Pick<DraftSettings, 'style' | 'rounds' | 'order'>): string[] {
  const out: string[] = [];
  for (let r = 0; r < s.rounds; r++) out.push(...(s.style === 'snake' && r % 2 ? [...s.order].reverse() : s.order));
  return out;
}

export interface DraftSlot {
  team: string;
  kind: DraftPick['kind'];
  round: number;
}

/** Every pick of a draft: the student rounds, then the coach rounds, each
 *  snaking (or not) on its own. */
export function draftSlots(s: Pick<DraftSettings, 'style' | 'rounds' | 'order'>, coachRounds = 0): DraftSlot[] {
  const phase = (kind: DraftSlot['kind'], rounds: number) => draftSequence({ style: s.style, rounds, order: s.order }).map((team, i) => ({ team, kind, round: Math.floor(i / s.order.length) + 1 }));
  return [...phase('student', s.rounds), ...phase('coach', coachRounds)];
}

/** Who is on the clock, or null once every pick is made. */
export function onTheClock(s: DraftSettings): { team: string; kind: DraftSlot['kind']; round: number; rounds: number; pickInRound: number; overall: number; total: number } | null {
  if (!s.live || !s.order.length) return null;
  const coachRounds = s.live.coachRounds ?? 0;
  const slots = draftSlots(s, coachRounds);
  const p = s.live.pick;
  if (p >= slots.length) return null;
  const slot = slots[p];
  const first = slots.findIndex((x) => x.kind === slot.kind);
  return { team: slot.team, kind: slot.kind, round: slot.round, rounds: slot.kind === 'student' ? s.rounds : coachRounds, pickInRound: ((p - first) % s.order.length) + 1, overall: p + 1, total: slots.length };
}

/** The pick after this one: past the rest of the student rounds once the
 *  pool is empty, and null once the draft is over. */
export function afterPick(s: DraftSettings, left: { students: number; coaches: number }): number | null {
  if (!s.live) return null;
  const slots = draftSlots(s, s.live.coachRounds ?? 0);
  let next = s.live.pick + 1;
  if (next < slots.length && slots[next].kind === 'student' && left.students <= 0) next = slots.findIndex((x) => x.kind === 'coach');
  if (next < 0 || next >= slots.length) return null;
  if (slots[next].kind === 'coach' && left.coaches <= 0) return null;
  return next;
}

/** How the draft went, squad by squad. */
export function draftRecap(picks: DraftPick[], teams: string[]): { team: string; students: string[]; coaches: string[] }[] {
  return teams.map((team) => ({
    team,
    students: picks.filter((p) => p.team === team && p.kind === 'student').map((p) => p.name),
    coaches: picks.filter((p) => p.team === team && p.kind === 'coach').map((p) => p.name)
  }));
}

/** Coaches serving with no squad yet: who the coach rounds pick from. */
export const coachPool = <T extends { team: string | null; job: string }>(crew: T[]): T[] => crew.filter((c) => !c.team && /\bcoach\b/i.test(c.job));

/** The draft order with squads added since it was set, and removed ones dropped. */
export function draftOrder(s: DraftSettings | undefined, teams: string[]): string[] {
  const kept = (s?.order ?? []).filter((t) => teams.includes(t));
  return [...kept, ...teams.filter((t) => !kept.includes(t))];
}
