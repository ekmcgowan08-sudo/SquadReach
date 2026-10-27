import { describe, expect, it } from 'vitest';
import { demoMinistry } from '@/lib/data/seed';
import { standings } from '@/lib/scoring';
import { seasonResult, withResult } from '@/lib/season-results';

describe('recording how a season finished', () => {
  const d = demoMinistry();
  it('takes the top squad, the top scorer and the students reached', () => {
    const r = seasonResult(d, '2026-11-19');
    expect(r.name).toBe('Fall 2026');
    expect(r.champion).toBe(standings(d.teams, d.cats, d.ledger)[0].name);
    expect(r.topScorer).toBeTruthy();
    expect(r.students).toBe(d.roster.filter((x) => !x.guest).length);
  });
  it('keeps one record per season, newest first', () => {
    const a = seasonResult(d, '2026-11-19');
    const list = withResult([{ ...a, ended: '2026-11-01' }, { ...a, name: 'Spring 2026' }], a);
    expect(list.map((x) => [x.name, x.ended])).toEqual([
      ['Fall 2026', '2026-11-19'],
      ['Spring 2026', '2026-11-19']
    ]);
  });
});
