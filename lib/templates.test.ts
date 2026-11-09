import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '@/lib/data/empty';
import { importLine, readTemplates } from '@/lib/templates';
import { DEFAULT_EVENT_TYPES } from '@/lib/types/model';

let n = 0;
const id = () => 'new' + n++;
const file = (folders: Record<string, unknown>) => ({ app: 'SquadRise', kind: 'templates', ministry: 'Hope Students', exportedAt: '2026-11-01', folders });

describe('templates another ministry exported', () => {
  it('come in beside ours, under new ids, with a name that isn’t taken', () => {
    const cfg = { ...DEFAULT_CONFIG, gameTemplates: [{ id: 'g1', name: 'Pipeline relay', setup: {} as never }] };
    const got = readTemplates(
      file({
        games: [{ id: 'x', name: 'Pipeline relay', setup: { format: 'heats' } }],
        smallgroups: [{ id: 'y', title: 'Icebreaker', notes: '', screens: [{ id: 's', type: 'thought', title: 'Hi', body: '' }] }],
        events: [{ id: 'z', title: DEFAULT_EVENT_TYPES[0].title, time: '7p', color: '#fff', roles: [] }, { id: 'z2', title: 'Lock-in', time: '9p', color: '#fff', roles: [] }],
        seasons: [{ name: 'Fall 2026', answers: { name: 'Fall 2026', weeks: 9 } }],
        nights: [{ date: '2026-11-18', label: 'x', items: [] }]
      }),
      cfg,
      [{ id: 's1', name: 'Fall 2026', answers: {}, active: true, savedAt: 0 }],
      id,
      5
    )!;
    expect(got.config.gameTemplates!.map((g) => [g.id, g.name])).toEqual([['g1', 'Pipeline relay'], [expect.stringMatching(/^new/), 'Pipeline relay (imported)']]);
    expect(got.config.sgTemplates![0].screens[0].id).toMatch(/^new/);
    expect(got.config.eventTypes!.map((e) => e.title)).toEqual([...DEFAULT_EVENT_TYPES.map((e) => e.title), 'Lock-in']);
    expect(got.seasons.map((s) => [s.name, s.active, s.answers.name])).toEqual([['Fall 2026', true, undefined], ['Fall 2026 (imported)', false, 'Fall 2026 (imported)']]);
    expect(got.counts).toEqual({ games: 1, smallgroups: 1, events: 1, seasons: 1, nights: 1 });
    expect(importLine(got.counts)).toBe('1 game, 1 small group, 1 event type and 1 season build');
  });

  it('refuse a file that isn’t a template export', () => {
    expect(readTemplates({ app: 'SquadRise', data: {} }, DEFAULT_CONFIG, [], id, 0)).toBeNull();
    expect(readTemplates(null, DEFAULT_CONFIG, [], id, 0)).toBeNull();
  });
});
