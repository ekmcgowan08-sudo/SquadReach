/* Draft day: squads take turns picking from the students who have no
   squad yet. Snake reverses the order every other round, so the squad
   that picks last in one round picks first in the next. */

export interface DraftSettings {
  style: 'snake' | 'straight';
  /** How many times each squad picks. */
  rounds: number;
  /** Squad ids, first pick first. */
  order: string[];
  /** While a draft is running: how many picks have been made. */
  live: { pick: number; startedAt: number } | null;
}

export interface TradeRecord {
  id: string;
  at: number;
  by: string;
  moves: { student: string; from: string | null; to: string }[];
}

export const DRAFT_DEFAULTS = (teams: string[]): DraftSettings => ({ style: 'snake', rounds: 3, order: teams, live: null });

/** Every pick of the draft in order: the squad id making it. */
export function draftSequence(s: Pick<DraftSettings, 'style' | 'rounds' | 'order'>): string[] {
  const out: string[] = [];
  for (let r = 0; r < s.rounds; r++) out.push(...(s.style === 'snake' && r % 2 ? [...s.order].reverse() : s.order));
  return out;
}

/** Who is on the clock, or null once every pick is made. */
export function onTheClock(s: DraftSettings): { team: string; round: number; pickInRound: number; overall: number } | null {
  if (!s.live || !s.order.length) return null;
  const seq = draftSequence(s);
  const p = s.live.pick;
  if (p >= seq.length) return null;
  return { team: seq[p], round: Math.floor(p / s.order.length) + 1, pickInRound: (p % s.order.length) + 1, overall: p + 1 };
}

/** The draft order with squads added since it was set, and removed ones dropped. */
export function draftOrder(s: DraftSettings | undefined, teams: string[]): string[] {
  const kept = (s?.order ?? []).filter((t) => teams.includes(t));
  return [...kept, ...teams.filter((t) => !kept.includes(t))];
}
