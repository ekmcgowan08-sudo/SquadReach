import { describe, expect, it } from 'vitest';
import { afterPick, carrySquads, coachPool, draftOrder, draftRecap, draftSequence, draftSlots, onTheClock, squadCarry } from '@/lib/draft';
import type { Student } from '@/lib/types/model';

describe('draft', () => {
  it('snakes every other round; straight keeps the order', () => {
    expect(draftSequence({ style: 'snake', rounds: 3, order: ['y', 'r', 'b'] })).toEqual(['y', 'r', 'b', 'b', 'r', 'y', 'y', 'r', 'b']);
    expect(draftSequence({ style: 'straight', rounds: 2, order: ['y', 'r'] })).toEqual(['y', 'r', 'y', 'r']);
  });
  it('says who is on the clock, and nobody once the picks run out', () => {
    const s = { style: 'snake' as const, rounds: 2, order: ['y', 'r', 'b'], live: { pick: 4, startedAt: 0 } };
    expect(onTheClock(s)).toEqual({ team: 'r', kind: 'student', round: 2, rounds: 2, pickInRound: 2, overall: 5, total: 6 });
    expect(onTheClock({ ...s, live: { pick: 6, startedAt: 0 } })).toBeNull();
    expect(onTheClock({ ...s, live: null })).toBeNull();
  });
  it('keeps the order current with the squads', () => {
    expect(draftOrder({ style: 'snake', rounds: 1, order: ['b', 'gone', 'y'], live: null }, ['y', 'r', 'b'])).toEqual(['b', 'y', 'r']);
    expect(draftOrder(undefined, ['y', 'r'])).toEqual(['y', 'r']);
  });

  it('takes the season’s answer, and the dynasty setting when the builder was left at its default', () => {
    expect(squadCarry('draft', true)).toBe('draft');
    expect(squadCarry('random', false)).toBe('random');
    expect(squadCarry(undefined, true)).toBe('keep');
    expect(squadCarry(undefined, false)).toBe('draft');
    expect(squadCarry(undefined, undefined)).toBe('pastor');
    expect(squadCarry('something else', undefined)).toBe('pastor');
  });
  const kid = (id: string, grade: string, team: string | null, captain = false): Student => ({ id, name: 'S' + id, grade, team, ...(captain ? { captain } : {}) });
  it('a redraft empties every squad, captains included; keeping or hand-placing moves nobody', () => {
    const roster = [kid('1', '7', 'y', true), kid('2', '8', 'r'), kid('3', '8', null)];
    expect(carrySquads(roster, ['y', 'r'], 'draft')).toEqual([
      { id: '1', name: 'S1', grade: '7', team: null, captain: false },
      { id: '2', name: 'S2', grade: '8', team: null, captain: false }
    ]);
    expect(carrySquads(roster, ['y', 'r'], 'keep')).toEqual([]);
    expect(carrySquads(roster, ['y', 'r'], 'pastor')).toEqual([]);
  });
  it('deals at random, level overall and within each grade', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const roster = [...Array.from({ length: 7 }, (_, i) => kid('a' + i, '6', null)), ...Array.from({ length: 5 }, (_, i) => kid('b' + i, '7', 'y')), ...Array.from({ length: 6 }, (_, i) => kid('c' + i, '8', 'r'))];
    const moved = carrySquads(roster, ['y', 'r', 'b'], 'random', rand);
    const after = roster.map((s) => moved.find((m) => m.id === s.id) ?? s);
    const count = (team: string, grade?: string) => after.filter((s) => s.team === team && (!grade || s.grade === grade)).length;
    expect(['y', 'r', 'b'].map((t) => count(t))).toEqual([6, 6, 6]);
    for (const g of ['6', '7', '8']) {
      const n = ['y', 'r', 'b'].map((t) => count(t, g));
      expect(Math.max(...n) - Math.min(...n)).toBeLessThanOrEqual(1);
    }
    expect(after.every((s) => s.team)).toBe(true);
    expect(carrySquads(roster, [], 'random', rand)).toEqual([]);
  });

  it('coach rounds follow the student rounds, each snaking on its own', () => {
    const base = { style: 'snake' as const, rounds: 2, order: ['y', 'r', 'b'] };
    expect(draftSlots(base, 1).map((x) => x.kind[0] + x.round + x.team)).toEqual(['s1y', 's1r', 's1b', 's2b', 's2r', 's2y', 'c1y', 'c1r', 'c1b']);
    const s = { ...base, live: { pick: 7, startedAt: 0, coachRounds: 1 } };
    expect(onTheClock(s)).toEqual({ team: 'r', kind: 'coach', round: 1, rounds: 1, pickInRound: 2, overall: 8, total: 9 });
  });
  it('skips the rest of the student rounds once the pool is empty, and ends when the coaches run out', () => {
    const s = { style: 'snake' as const, rounds: 3, order: ['y', 'r'], live: { pick: 1, startedAt: 0, coachRounds: 1 } };
    expect(afterPick(s, { students: 3, coaches: 2 })).toBe(2);
    expect(afterPick(s, { students: 0, coaches: 2 })).toBe(6);
    expect(afterPick(s, { students: 0, coaches: 0 })).toBeNull();
    expect(afterPick({ ...s, live: { pick: 6, startedAt: 0, coachRounds: 1 } }, { students: 0, coaches: 1 })).toBe(7);
    expect(afterPick({ ...s, live: { pick: 7, startedAt: 0, coachRounds: 1 } }, { students: 0, coaches: 5 })).toBeNull();
    expect(afterPick({ ...s, live: { pick: 5, startedAt: 0 } }, { students: 4, coaches: 4 })).toBeNull();
  });
  it('recaps the draft by squad, and pools only coaches with no squad', () => {
    const picks = [{ kind: 'student' as const, round: 1, team: 'y', name: 'Ann' }, { kind: 'student' as const, round: 1, team: 'r', name: 'Bo' }, { kind: 'coach' as const, round: 1, team: 'y', name: 'Cy' }];
    expect(draftRecap(picks, ['y', 'r'])).toEqual([{ team: 'y', students: ['Ann'], coaches: ['Cy'] }, { team: 'r', students: ['Bo'], coaches: [] }]);
    const crew = [{ team: null, job: 'Coach', name: 'a' }, { team: 'y', job: 'Coach · Yellow', name: 'b' }, { team: null, job: 'Scorekeeper', name: 'c' }, { team: null, job: 'Head coach', name: 'd' }];
    expect(coachPool(crew).map((c) => c.name)).toEqual(['a', 'd']);
  });
});
