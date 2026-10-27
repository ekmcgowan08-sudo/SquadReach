import { describe, expect, it } from 'vitest';
import { formatOf, formatSummary, periodKeys, periodName } from '@/lib/game-format';

describe('the shape of a game', () => {
  it('says it in a line', () => {
    expect(formatSummary({ segment: 'rounds', count: 4, minutes: 5, ends: 'clock', toWin: 21, maxPlayers: 10 })).toBe('4 rounds × 5 min — the scoreboard runs a clock · first to 21 · 10 on the field');
    expect(formatSummary({ segment: 'innings', count: 3, ends: 'outs' })).toBe('3 innings — each ends on outs');
    expect(formatSummary({ segment: 'continuous', minutes: 20, ends: 'clock' })).toBe('One continuous game, 20 min');
  });
  it('keeps halves at two and a continuous game at one', () => {
    expect(formatOf({ segment: 'halves', count: 5 }).count).toBe(2);
    expect(periodKeys({ segment: 'continuous' })).toEqual(['1', 'OT']);
  });
  it('names the recorder’s periods', () => {
    expect(periodKeys({ segment: 'quarters', count: 4 })).toEqual(['1', '2', '3', '4', 'OT']);
    expect(periodName({ segment: 'quarters' }, '3')).toBe('Quarter 3');
    expect(periodName({ segment: 'continuous' }, '1')).toBe('Game');
    expect(periodName({}, 'OT')).toBe('Overtime');
  });
});
