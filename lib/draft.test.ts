import { describe, expect, it } from 'vitest';
import { draftOrder, draftSequence, onTheClock } from '@/lib/draft';

describe('draft', () => {
  it('snakes every other round; straight keeps the order', () => {
    expect(draftSequence({ style: 'snake', rounds: 3, order: ['y', 'r', 'b'] })).toEqual(['y', 'r', 'b', 'b', 'r', 'y', 'y', 'r', 'b']);
    expect(draftSequence({ style: 'straight', rounds: 2, order: ['y', 'r'] })).toEqual(['y', 'r', 'y', 'r']);
  });
  it('says who is on the clock, and nobody once the picks run out', () => {
    const s = { style: 'snake' as const, rounds: 2, order: ['y', 'r', 'b'], live: { pick: 4, startedAt: 0 } };
    expect(onTheClock(s)).toEqual({ team: 'r', round: 2, pickInRound: 2, overall: 5 });
    expect(onTheClock({ ...s, live: { pick: 6, startedAt: 0 } })).toBeNull();
    expect(onTheClock({ ...s, live: null })).toBeNull();
  });
  it('keeps the order current with the squads', () => {
    expect(draftOrder({ style: 'snake', rounds: 1, order: ['b', 'gone', 'y'], live: null }, ['y', 'r', 'b'])).toEqual(['b', 'y', 'r']);
    expect(draftOrder(undefined, ['y', 'r'])).toEqual(['y', 'r']);
  });
});
