import { describe, expect, it } from 'vitest';
import { gameGoals, gameMvp, playerStats } from '@/lib/goals';
import type { LedgerEntry } from '@/lib/types/model';

const e = (over: Partial<LedgerEntry>): LedgerEntry => ({ id: Math.random().toString(36).slice(2), team: 'red', cat: 'games', amount: 25, by: 'Sam', why: 'Goal', at: 100, status: 'approved', ...over });

describe('goals, assists and MVPs read from the ledger', () => {
  const g1 = e({ id: 'g1', student: 'Ava', detail: { goal: { assist: 'Ben' } }, at: 100 });
  const g2 = e({ id: 'g2', student: 'Ava', detail: { goal: {} }, at: 110 });
  const g3 = e({ id: 'g3', team: 'blue', student: 'Cal', detail: { goal: {} }, at: 120 });
  const undo = e({ id: 'u', amount: -25, reverses: 'g2', at: 130 });
  const old = e({ id: 'old', student: 'Ava', detail: { goal: {} }, at: 10 });
  const mvp = e({ id: 'm', student: 'Cal', team: 'blue', detail: { mvp: true }, at: 140 });
  const withdrawn = e({ id: 'w', student: 'Ben', detail: { goal: {} }, status: 'rejected', at: 150 });
  const all = [g1, g2, g3, undo, old, mvp, withdrawn];

  it('count this game’s goals by squad, leaving out reversed, withdrawn and earlier ones', () => {
    expect(gameGoals(all, 50).byTeam).toEqual({ red: 1, blue: 1 });
    expect(gameGoals(all, 0).byTeam).toEqual({ red: 2, blue: 1 });
  });
  it('name this game’s MVP', () => {
    expect(gameMvp(all, 50)?.student).toBe('Cal');
    expect(gameMvp(all, 200)).toBeNull();
  });
  it('add up each player’s goals, assists and MVPs, best first', () => {
    expect(playerStats(all)).toEqual([
      { name: 'Ava', team: 'red', goals: 2, assists: 0, mvp: 0 },
      { name: 'Cal', team: 'blue', goals: 1, assists: 0, mvp: 1 },
      { name: 'Ben', team: 'red', goals: 0, assists: 1, mvp: 0 }
    ]);
  });
});
