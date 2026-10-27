/* How a game is shaped: rounds, quarters or halves (or one continuous
   game), how many and how long, what ends one, how it's scored, the
   target and how many play at once. The recorder names its periods from
   this, and Game rules says it in a line. */

export const SEGMENTS = [
  { id: 'rounds', label: 'Rounds', one: 'Round' },
  { id: 'innings', label: 'Innings', one: 'Inning' },
  { id: 'quarters', label: 'Quarters', one: 'Quarter' },
  { id: 'periods', label: 'Periods', one: 'Period' },
  { id: 'halves', label: 'Halves', one: 'Half' },
  { id: 'heats', label: 'Heats', one: 'Heat' },
  { id: 'continuous', label: 'One continuous game', one: 'Game' }
] as const;
export type SegmentKind = (typeof SEGMENTS)[number]['id'];

export const ENDS = [
  { id: 'clock', label: 'Time on the clock' },
  { id: 'outs', label: 'A number of outs' },
  { id: 'possession', label: 'Change of possession' },
  { id: 'points', label: 'A point total' },
  { id: 'leader', label: 'A leader calls it' }
] as const;
export type SegmentEnd = (typeof ENDS)[number]['id'];

export const SCORING = [
  { id: 'goals', label: 'Goals / points' },
  { id: 'placement', label: 'Placement (fastest / first)' },
  { id: 'time', label: 'Time-based only' }
] as const;
export type ScoringStyle = (typeof SCORING)[number]['id'];

export interface GameFormat {
  segment: SegmentKind;
  count: number;
  /** Minutes in each segment (or the whole game when continuous). */
  minutes: number;
  ends: SegmentEnd;
  scoring: ScoringStyle;
  toWin: number | null;
  maxPlayers: number | null;
}

export const FORMAT_DEFAULTS: GameFormat = { segment: 'periods', count: 4, minutes: 5, ends: 'clock', scoring: 'goals', toWin: null, maxPlayers: null };

export const formatOf = (f: Partial<GameFormat> | undefined): GameFormat => {
  const out = { ...FORMAT_DEFAULTS, ...f };
  if (out.segment === 'halves') out.count = 2;
  if (out.segment === 'continuous') out.count = 1;
  out.count = Math.max(1, Math.min(12, Math.round(out.count)));
  out.minutes = Math.max(1, Math.min(120, Math.round(out.minutes)));
  return out;
};

const seg = (f: GameFormat) => SEGMENTS.find((s) => s.id === f.segment) ?? SEGMENTS[3];

/** "4 rounds × 5 min — the scoreboard runs a clock · first to 21 · 10 on the field". */
export function formatSummary(fmt: Partial<GameFormat> | undefined): string {
  const f = formatOf(fmt);
  const s = seg(f);
  const end = f.ends === 'clock' ? 'the scoreboard runs a clock' : f.ends === 'outs' ? 'each ends on outs' : f.ends === 'possession' ? 'each ends on a change of possession' : f.ends === 'points' ? 'each ends at a point total' : 'a leader calls each one';
  const head = f.segment === 'continuous' ? 'One continuous game' + (f.ends === 'clock' ? ', ' + f.minutes + ' min' : '') : f.count + ' ' + s.label.toLowerCase() + (f.ends === 'clock' ? ' × ' + f.minutes + ' min' : '') + ' — ' + end;
  const extra = [f.toWin ? 'first to ' + f.toWin : '', f.maxPlayers ? f.maxPlayers + ' on the field' : ''].filter(Boolean);
  return [head, ...extra].join(' · ');
}

/** The period buttons on the recorder: 1…n, then overtime. */
export function periodKeys(fmt: Partial<GameFormat> | undefined): string[] {
  const f = formatOf(fmt);
  return f.segment === 'continuous' ? ['1', 'OT'] : [...Array.from({ length: f.count }, (_, i) => String(i + 1)), 'OT'];
}

/** "Round 2", "Overtime", "Game" — what the scoreboard on film calls it. */
export function periodName(fmt: Partial<GameFormat> | undefined, key: string): string {
  const f = formatOf(fmt);
  if (key === 'OT') return 'Overtime';
  return f.segment === 'continuous' ? 'Game' : seg(f).one + ' ' + key;
}
