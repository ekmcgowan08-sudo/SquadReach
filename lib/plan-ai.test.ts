import { describe, expect, it } from 'vitest';
import { demoPlan } from '@/lib/data/seed-plan';
import { cleanIdeas, planBrief, type RawIdeas } from '@/lib/plan-ai';

const p = demoPlan(Date.UTC(2026, 9, 23));
const idea = (over: Partial<RawIdeas['ideas'][number]> = {}): RawIdeas['ideas'][number] => ({
  title: 'Romans: Grace Explained',
  year: 2,
  month: 1,
  weeks: 8,
  big_idea: 'Grace is God’s gift, not our wage.',
  passages: ['Romans 3:21–26', 'Romans 8', 'Romans 12:1–2'],
  tags: ['paul', 'grace', 'made-up'],
  reason: '2028–29 has 8 of 52 nights taught and no class gets Paul’s letters twice.',
  ...over
});

describe('Claude’s plan suggestions', () => {
  it('briefs Claude with the church, the years and the gaps — no student names', () => {
    const b = planBrief(p, 2026);
    expect(b).toContain('"translation": "KJV"');
    expect(b).toContain('Alive: Ephesians');
    expect(b).toContain('Coverage gaps');
    expect(b).not.toContain('Ellison');
  });

  it('keeps a good idea as a suggestion, with only known coverage tags', () => {
    const [s] = cleanIdeas({ ideas: [idea()] }, p);
    expect(s).toMatchObject({ id: 'sug:claude|romans: grace explained', year: 2, size: 8, month: 1, rule: 'claude', tags: ['paul', 'grace'] });
    expect(s.cites).toEqual(['Romans 3:21–26', 'Romans 8', 'Romans 12:1–2']);
  });

  it('drops ideas that break the rules instead of repairing them', () => {
    const bad = [
      idea({ passages: ['the whole Bible', 'Love chapter'] }), // no real references
      idea({ title: 'Quoted', big_idea: '“For God so loved the world, that he gave his only begotten Son”' }), // a quotation
      idea({ title: 'Too far', year: 9 }),
      idea({ title: 'Too long', weeks: 30 }),
      idea({ title: 'Alive: Ephesians' }) // already in the plan
    ];
    expect(cleanIdeas({ ideas: bad }, p)).toEqual([]);
  });

  it('accepts the usual shapes of a reference', () => {
    const refs = ['Psalm 23', '1 Corinthians 13:4–7', 'Acts 1–2', 'Song of Solomon 2', 'John 20:30-31'];
    const [s] = cleanIdeas({ ideas: [idea({ title: 'Shapes', passages: refs })] }, p);
    expect(s.cites).toEqual(refs);
  });

  it('honours a suggestion a leader already set aside', () => {
    const q = structuredClone(p);
    q.dismissed.push({ id: 'sug:claude|romans: grace explained', reason: 'Doing Romans at camp', at: 0, by: 'Pastor Mike' });
    expect(cleanIdeas({ ideas: [idea()] }, q)).toEqual([]);
  });
});
