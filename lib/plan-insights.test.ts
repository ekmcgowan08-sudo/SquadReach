import { describe, expect, it } from 'vitest';
import { demoPlan } from '@/lib/data/seed-plan';
import { assessCoverage, cohortYears, cohorts, planChecks, publishDiff, suggestions } from '@/lib/plan-insights';

const fresh = () => demoPlan(0);

describe('coverage', () => {
  it('follows a class through its seven years', () => {
    const p = fresh();
    const ys = cohortYears(p, 2033);
    expect(ys[0]).toEqual({ grade: 6, year: 2026, inPlan: true });
    expect(ys[6]).toEqual({ grade: 12, year: 2032, inPlan: true });
    expect(cohorts(p)).toHaveLength(7);
    expect(cohorts(p)).toContain(2033);
  });

  it('reads coverage off the tags of the teaching a class sits under', () => {
    const p = fresh();
    const grace = assessCoverage(p, 'grace', 2033, 2026);
    expect(grace.entries.map((e) => e.title)).toContain('Alive: Ephesians');
    expect(grace.entries[0].state).toBe('current');
    const revelation = assessCoverage(p, 'revelation', 2033, 2026);
    expect(revelation.status).toBe('gap');
    expect(revelation.reason).toContain('No series carries the tag');
  });

  it('keeps a dismissal, with its reason, only on a warning', () => {
    const p = fresh();
    p.dismissed.push({ id: 'cov:revelation|2033', reason: 'Covered at camp', at: 1, by: 'Mike' });
    expect(assessCoverage(p, 'revelation', 2033, 2026).dismissed?.reason).toBe('Covered at camp');
  });
});

describe('checks', () => {
  it('flags an empty year as a gap and offers a draft series', () => {
    const p = fresh();
    const y4 = planChecks(p, 2026, 2).find((c) => c.id === 'weeks|4')!;
    expect(y4.status).toBe('gap');
    expect(y4.fix).toBeTruthy();
    y4.fix!.apply(p, () => 'new1');
    expect(p.items.find((i) => i.id === 'new1')?.suggested?.rule).toBe('teaching-gap');
  });

  it('flags a goal nothing confirmed supports', () => {
    const c = planChecks(fresh(), 2026, 2).filter((x) => x.id.startsWith('goal|'));
    expect(c.find((x) => x.title.includes('mentor'))!.status).toBe('gap');
    expect(c.find((x) => x.title.includes('small group'))!.status).toBe('healthy');
  });

  it('asks for debriefs only on what has already run', () => {
    const c = planChecks(fresh(), 2026, 3).find((x) => x.id === 'debrief')!;
    expect(c.reason).toContain('Alive: Ephesians');
    expect(c.reason).not.toContain('Summer camp');
  });

  it('confirms year-one drafts in one step', () => {
    const p = fresh();
    const c = planChecks(p, 2026, 2).find((x) => x.id === 'y1drafts')!;
    expect(c.status).toBe('attention');
    c.fix!.apply(p, () => 'x');
    expect(planChecks(p, 2026, 2).find((x) => x.id === 'y1drafts')!.status).toBe('healthy');
  });
});

describe('suggestions and publishing', () => {
  it('offers a series the plan doesn’t name, and a rhythm missing next year', () => {
    const s = suggestions(fresh());
    expect(s.some((x) => x.rule === 'teaching-gap' && x.year === 2)).toBe(true);
    const r = s.find((x) => x.rule === 'yearly-rhythm' && x.title === 'Fall retreat')!;
    expect(r.year).toBe(1);
    expect(r.reason).toContain('Three weeks of promo');
    expect(s.some((x) => x.title === 'Summer camp')).toBe(false);
  });

  it('drops a dismissed suggestion', () => {
    const p = fresh();
    const first = suggestions(p)[0];
    p.dismissed.push({ id: first.id, reason: 'Not this year', at: 1, by: 'Mike' });
    expect(suggestions(p).some((x) => x.id === first.id)).toBe(false);
  });

  it('shows exactly what publishing would change', () => {
    const p = fresh();
    const d = publishDiff(p);
    expect(d.added.map((i) => i.title)).toEqual(['Summer camp']);
    expect(d.changed).toHaveLength(0);
    p.items.find((i) => i.title === 'Fall retreat')!.month = 4;
    p.items = p.items.filter((i) => i.title !== 'All-nighter');
    const d2 = publishDiff(p);
    expect(d2.changed.map((i) => i.title)).toEqual(['Fall retreat']);
    expect(d2.removed.map((i) => i.title)).toEqual(['All-nighter']);
  });
});
