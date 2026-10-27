/* Small-group guides: who sees which, the templates a leader starts from,
   and copying one without sharing ids. */
import type { SmallGroup, SmallGroupScreen, SmallGroupTemplate } from '@/lib/types/model';

/** A guide is for every squad unless a leader picked some. */
export const sgForTeam = (g: Pick<SmallGroup, 'teams'>, teamId: string) => !g.teams?.length || g.teams.includes(teamId);

export const SG_TEMPLATES: SmallGroupTemplate[] = [
  {
    id: 'tpl-icebreaker',
    title: 'Icebreaker Night',
    notes: 'For a first week or a mixed room. Keep it light; everyone talks once.',
    screens: [
      { id: 's1', type: 'thought', title: 'Two truths and a lie', body: 'Each person says three things about themselves. The group guesses which one isn’t true.' },
      { id: 's2', type: 'wyr', title: 'Would you rather', body: 'Pick a side and say why.', options: ['Lose your phone for a week', 'Lose your voice for a week'] },
      { id: 's3', type: 'pass', title: 'Pass the phone', body: 'What’s one thing that made this week better than last week?' },
      { id: 's4', type: 'prayer', title: 'Prayer requests', body: 'One thing each person would like prayer for. Pray for the person on your left.' }
    ]
  },
  {
    id: 'tpl-game',
    title: 'Game Night',
    notes: 'After a big game: play, vote, then land one thought.',
    screens: [
      { id: 's1', type: 'game', title: 'Squad challenge', body: 'Ninety seconds: build the tallest tower you can from what’s in your pockets.' },
      { id: 's2', type: 'poll', title: 'Quick vote', body: 'Who played tonight’s game the hardest?', options: ['Our squad', 'Another squad', 'Honestly, the leaders'] },
      { id: 's3', type: 'thought', title: 'One thought', body: 'What does how we played tonight say about how we treat each other the rest of the week?' }
    ]
  },
  {
    id: 'tpl-deep',
    title: 'Deep-Dive Study',
    notes: 'One passage, read slowly. Add the reference and the text in your translation.',
    screens: [
      { id: 's1', type: 'scripture', title: 'Read it together', body: 'Paste the passage here in your translation.', ref: '' },
      { id: 's2', type: 'pass', title: 'What stood out', body: 'Read it again. What word or line stood out to you, and why?' },
      { id: 's3', type: 'checklist', title: 'This week', body: 'Pick one to do before next week.', items: ['Read the passage again on Wednesday', 'Text one person what you learned', 'Pray it back to God in your own words'] }
    ]
  }
];

const fresh = (screens: SmallGroupScreen[], id: () => string) => screens.map((s) => ({ ...s, id: id() }));

/** A new guide from a template, for a week. */
export function fromTemplate(t: SmallGroupTemplate, week: number, id: () => string): SmallGroup {
  return { id: id(), title: 'Week ' + week + ' · ' + t.title, notes: t.notes, screens: fresh(t.screens, id), weekNumber: week };
}

/** A copy of a guide: new ids, same week and squads, no student answers. */
export function duplicateGroup(g: SmallGroup, id: () => string): SmallGroup {
  return { ...structuredClone(g), id: id(), title: g.title + ' (copy)', screens: fresh(g.screens, id) };
}

/** A guide kept as a template: the screens and notes, not the week. */
export function asTemplate(g: SmallGroup, id: () => string): SmallGroupTemplate {
  return { id: id(), title: g.title.replace(/^Week \d+ · /, ''), notes: g.notes, screens: fresh(g.screens, id) };
}
