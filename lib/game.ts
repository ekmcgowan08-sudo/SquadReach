/* The game timer, as pure functions. A lane's time is what it banked plus
   how long it has been running since its start stamp, so every screen that
   reads the same state — the timekeeper's phone, the projector — shows the
   same clock without anything ticking in the data. */
import type { BracketData, GameState, HeatLane, LiveEffect, Penalty, Team } from '@/lib/types/model';

export const DEFAULT_PENALTIES: Penalty[] = [
  { id: 'freeze', label: 'Freeze', sec: 30, kind: 'add', icon: 'ph-snowflake', color: '#38bdf8', style: 'blur', rule: 'Team must stand completely still — no talking, no moving — until it clears.' },
  { id: 'chaos', label: 'Chaos', sec: 30, kind: 'add', icon: 'ph-shuffle', color: '#f97316', style: 'chaos', rule: 'Every player swaps to a new spot right now.' },
  { id: 'slowmo', label: 'Slow-Mo', sec: 30, kind: 'add', icon: 'ph-gauge', color: '#968ae0', style: 'blur', rule: 'Team must move in exaggerated slow motion.' },
  { id: 'speedboost', label: 'Speed Boost', sec: 20, kind: 'subtract', icon: 'ph-lightning', color: '#22c55e', style: 'glow', rule: 'Team may move at double speed.' },
  { id: 'shrink', label: 'Shrink Ray', sec: 30, kind: 'add', icon: 'ph-arrows-in', color: '#eab308', style: 'scale', rule: 'Whole team huddles as small and low as possible.' },
  { id: 'confetti', label: 'Confetti Burst', sec: 20, kind: 'subtract', icon: 'ph-confetti', color: '#ec4899', style: 'confetti', rule: 'Celebration — bonus seconds off the clock.' },
  { id: 'lightning', label: 'Lightning Strike', sec: 25, kind: 'add', icon: 'ph-cloud-lightning', color: '#facc15', style: 'flash', rule: 'One random player freezes in place until it clears.' },
  { id: 'fog', label: 'Fog Out', sec: 30, kind: 'add', icon: 'ph-cloud-fog', color: '#64748b', style: 'blur', rule: 'Team closes their eyes until it clears.' }
];

export const emptyLane = (): HeatLane => ({ elapsedMs: 0, startedAt: null, counts: {} });

export const bracketOf = (g: GameState): BracketData => g.bracket ?? { enabled: false, seeds: [], winners: {}, liveSeed: true, paid: {} };

export function emptyGame(): GameState {
  return { mode: 'single', h2hPick: [], lanes: {}, solo: { mode: 'up', targetSec: 120, elapsedMs: 0, startedAt: null }, effects: [] };
}

export const laneOf = (g: GameState, teamId: string): HeatLane => g.lanes[teamId] ?? emptyLane();

/** Seconds a lane has run, including the stretch since it was started. */
export function laneSec(lane: HeatLane, now = Date.now()): number {
  return (lane.elapsedMs + (lane.startedAt != null ? Math.max(0, now - lane.startedAt) : 0)) / 1000;
}

/** Net seconds from penalty and bonus taps: penalties add, bonuses subtract. */
export function penaltySec(lane: HeatLane, penalties: Penalty[]): number {
  return penalties.reduce((n, p) => n + (lane.counts[p.id] ?? 0) * p.sec * (p.kind === 'subtract' ? -1 : 1), 0);
}

export function soloSec(g: GameState, now = Date.now()): number {
  const ran = (g.solo.elapsedMs + (g.solo.startedAt != null ? Math.max(0, now - g.solo.startedAt) : 0)) / 1000;
  return g.solo.mode === 'down' ? Math.max(0, g.solo.targetSec - ran) : ran;
}

/** m:ss.t — tenths, the way a heat is read out. */
export function clock(sec: number): string {
  const t = Math.max(0, sec);
  const m = Math.floor(t / 60);
  const rest = t - m * 60;
  return m + ':' + (rest < 10 ? '0' : '') + rest.toFixed(1);
}

export const startLane = (lane: HeatLane, now = Date.now()): HeatLane => (lane.startedAt != null ? lane : { ...lane, startedAt: now });
export const stopLane = (lane: HeatLane, now = Date.now()): HeatLane =>
  lane.startedAt == null ? lane : { ...lane, elapsedMs: lane.elapsedMs + Math.max(0, now - lane.startedAt), startedAt: null };

/** The squads racing in the current mode. */
export function activeTeams(g: GameState, teams: Team[]): Team[] {
  if (g.mode === 'h2h') return teams.filter((t) => g.h2hPick.includes(t.id));
  if (g.mode === 'all') return teams;
  return [];
}

export interface HeatRow {
  team: Team;
  raw: number;
  pen: number;
  adj: number;
  ran: boolean;
  running: boolean;
  place: number | null;
}

/** Every active lane with its adjusted time and finishing place. A lane
 *  that never ran has no place. Ties keep the squads' setup order. */
export function heatRows(g: GameState, teams: Team[], penalties: Penalty[], now = Date.now()): HeatRow[] {
  const rows = activeTeams(g, teams).map((team) => {
    const lane = laneOf(g, team.id);
    const raw = laneSec(lane, now);
    const pen = penaltySec(lane, penalties);
    return { team, raw, pen, adj: Math.max(0, raw + pen), ran: raw > 0, running: lane.startedAt != null, place: null as number | null };
  });
  const finished = rows.filter((r) => r.ran).sort((a, b) => a.adj - b.adj);
  finished.forEach((r, i) => (r.place = i + 1));
  return rows;
}

/** "Blue ran it fastest, but penalties put Red in first." — or null. */
export function flipNote(rows: HeatRow[]): string | null {
  const ran = rows.filter((r) => r.ran);
  if (ran.length < 2) return null;
  const raw = [...ran].sort((a, b) => a.raw - b.raw)[0];
  const adj = [...ran].sort((a, b) => a.adj - b.adj)[0];
  return raw.team.id === adj.team.id ? null : raw.team.name + ' ran it fastest, but penalties put ' + adj.team.name + ' in first.';
}

/** Placement points: last place earns one base, each place above one more. */
export function placementAwards(rows: HeatRow[], base: number): { team: string; amount: number; place: number }[] {
  const order = rows.filter((r) => r.ran).sort((a, b) => a.adj - b.adj);
  return order.map((r, i) => ({ team: r.team.id, amount: base * (order.length - i), place: i + 1 }));
}

/** Effects still on screen at `now`. */
export const liveEffects = (g: GameState, now = Date.now()) => g.effects.filter((e) => now < e.startAt + e.sec * 1000);

/** Put an effect on screen for some squads: one per squad, for as long as
 *  it costs (thirty seconds at most), dropping any that have run out. */
export function withEffect(g: GameState, p: Penalty, teamIds: string[], by: string | null, now: number, id: () => string): LiveEffect[] {
  const sec = Math.min(p.sec, 30) || 10;
  return liveEffects(g, now).concat(teamIds.map((teamId) => ({ key: id(), teamId, penaltyId: p.id, startAt: now, sec, by })));
}
