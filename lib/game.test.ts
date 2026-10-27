import { describe, expect, it } from 'vitest';
import { DEFAULT_PENALTIES, clock, emptyGame, flipNote, heatRows, laneSec, penaltySec, placementAwards, soloSec, startLane, stopLane, withEffect } from '@/lib/game';
import type { GameState, Team } from '@/lib/types/model';

const teams: Team[] = [
  { id: 'blue', name: 'Blue', color: '#2563EB' },
  { id: 'red', name: 'Red', color: '#DC2626' },
  { id: 'green', name: 'Green', color: '#16A34A' }
] as Team[];

describe('lanes', () => {
  it('banks time across stop and start, and counts the running stretch', () => {
    let lane = startLane({ elapsedMs: 0, startedAt: null, counts: {} }, 1000);
    lane = stopLane(lane, 6000);
    expect(lane.elapsedMs).toBe(5000);
    lane = startLane(lane, 10_000);
    expect(laneSec(lane, 12_500)).toBe(7.5);
  });

  it('adds penalties and subtracts bonuses', () => {
    const lane = { elapsedMs: 0, startedAt: null, counts: { freeze: 2, speedboost: 1 } };
    expect(penaltySec(lane, DEFAULT_PENALTIES)).toBe(2 * 30 - 20);
  });

  it('counts down from the target and never below zero', () => {
    const g = emptyGame();
    g.solo = { mode: 'down', targetSec: 60, elapsedMs: 0, startedAt: 0 };
    expect(soloSec(g, 15_000)).toBe(45);
    expect(soloSec(g, 90_000)).toBe(0);
  });

  it('formats tenths', () => {
    expect(clock(65.25)).toBe('1:05.3');
    expect(clock(-3)).toBe('0:00.0');
  });
});

describe('heat results', () => {
  const g: GameState = {
    ...emptyGame(),
    mode: 'all',
    lanes: {
      blue: { elapsedMs: 50_000, startedAt: null, counts: { freeze: 1 } },
      red: { elapsedMs: 60_000, startedAt: null, counts: {} },
      green: { elapsedMs: 0, startedAt: null, counts: {} }
    }
  };

  it('places by adjusted time and leaves an unrun lane unplaced', () => {
    const rows = heatRows(g, teams, DEFAULT_PENALTIES, 0);
    expect(rows.find((r) => r.team.id === 'red')?.place).toBe(1);
    expect(rows.find((r) => r.team.id === 'blue')?.place).toBe(2);
    expect(rows.find((r) => r.team.id === 'green')?.place).toBeNull();
  });

  it('says when penalties flipped the order', () => {
    expect(flipNote(heatRows(g, teams, DEFAULT_PENALTIES, 0))).toBe('Blue ran it fastest, but penalties put Red in first.');
  });

  it('pays one base per place from the bottom', () => {
    expect(placementAwards(heatRows(g, teams, DEFAULT_PENALTIES, 0), 100)).toEqual([
      { team: 'red', amount: 200, place: 1 },
      { team: 'blue', amount: 100, place: 2 }
    ]);
  });

  it('only races the two picked squads head-to-head', () => {
    const h: GameState = { ...g, mode: 'h2h', h2hPick: ['blue', 'green'] };
    expect(heatRows(h, teams, DEFAULT_PENALTIES, 0).map((r) => r.team.id)).toEqual(['blue', 'green']);
  });
});

describe('effects on the room screen', () => {
  it('puts one on each squad for as long as it costs, at most thirty seconds, and drops the expired', () => {
    let n = 0;
    const g = { ...emptyGame(), effects: [{ key: 'old', teamId: 'red', penaltyId: 'freeze', startAt: 0, sec: 10 }] };
    const freeze = DEFAULT_PENALTIES[0];
    const fx = withEffect(g, { ...freeze, sec: 45 }, ['blue', 'green'], 'red', 60_000, () => 'k' + ++n);
    expect(fx.map((e) => [e.teamId, e.sec, e.by])).toEqual([
      ['blue', 30, 'red'],
      ['green', 30, 'red']
    ]);
  });
});
