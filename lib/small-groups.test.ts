import { describe, expect, it } from 'vitest';
import { SG_TEMPLATES, asTemplate, duplicateGroup, fromTemplate, sgForTeam } from '@/lib/small-groups';

let n = 0;
const id = () => 'id' + ++n;

describe('small-group guides', () => {
  it('are for every squad unless some are picked', () => {
    expect(sgForTeam({}, 'red')).toBe(true);
    expect(sgForTeam({ teams: null }, 'red')).toBe(true);
    expect(sgForTeam({ teams: [] }, 'red')).toBe(true);
    expect(sgForTeam({ teams: ['blue'] }, 'red')).toBe(false);
    expect(sgForTeam({ teams: ['blue', 'red'] }, 'red')).toBe(true);
  });
  it('start from a template for a week, with their own ids', () => {
    const g = fromTemplate(SG_TEMPLATES[0], 4, id);
    expect(g.title).toBe('Week 4 · Icebreaker Night');
    expect(g.weekNumber).toBe(4);
    expect(g.screens.map((s) => s.id)).not.toContain('s1');
  });
  it('copy without sharing ids, and keep as a template without the week', () => {
    const g = { id: 'g', title: 'Week 9 · Identity in Christ', notes: 'n', weekNumber: 9, teams: ['red'], screens: [{ id: 'a', type: 'thought', title: 't', body: 'b' }] };
    const c = duplicateGroup(g, id);
    expect(c.id).not.toBe('g');
    expect(c.title).toBe('Week 9 · Identity in Christ (copy)');
    expect(c.teams).toEqual(['red']);
    expect(c.screens[0].id).not.toBe('a');
    const t = asTemplate(g, id);
    expect(t.title).toBe('Identity in Christ');
    expect('weekNumber' in t).toBe(false);
  });
});
