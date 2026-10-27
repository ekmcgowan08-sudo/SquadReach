import { describe, expect, it } from 'vitest';
import { drillsIn } from '@/lib/bible';

describe('drillsIn', () => {
  it('runs every drill when nothing is set', () => {
    expect(drillsIn(undefined, 3)).toHaveLength(6);
  });
  it('runs a drill only in its weeks, and not at all when switched off', () => {
    const ids = drillsIn({ say: [], scramble: [2, 4] }, 4).map((x) => x.id);
    expect(ids).toContain('scramble');
    expect(ids).not.toContain('say');
    expect(drillsIn({ scramble: [2, 4] }, 3).map((x) => x.id)).not.toContain('scramble');
  });
  it('never leaves a week with nothing to practise', () => {
    const off = { flashcard: [], firstletter: [], blank: [], type: [], say: [], scramble: [] };
    expect(drillsIn(off, 1).map((x) => x.id)).toEqual(['flashcard']);
  });
});
