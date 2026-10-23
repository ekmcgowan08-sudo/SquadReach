/* The demo ministry's seven-year plan. Year one (2026–27) is planned and
   partly run; years two and three are partly drawn; the rest are honestly
   empty — which is what a real plan looks like in its first fall. */
import { emptyPlan, type ItemKind, type Plan, type PlanItem } from '@/lib/plan';

const I = (lane: string, year: number, title: string, kind: ItemKind, size: number, status: PlanItem['status'], extra: Partial<PlanItem> = {}): Omit<PlanItem, 'id'> => ({
  lane, year, title, kind, size, status, notes: '', tags: [], ...extra
});

const ITEMS: Omit<PlanItem, 'id'>[] = [
  I('teach', 0, 'Alive: Ephesians', 'series', 9, 'confirmed', { month: 1, tags: ['grace', 'church', 'paul', 'identity'], refs: 'Ephesians 1–6', bigIdea: 'You were dead; now you are alive, together.' }),
  I('teach', 0, 'Hard Questions', 'series', 4, 'confirmed', { month: 3, tags: ['god', 'scripture', 'anxiety'], bigIdea: 'Doubt is not disqualifying.', debrief: { worked: 'Anonymous question cards; the room stayed honest.', change: 'Needs a second leader in small groups for the doubt night.' } }),
  I('teach', 0, 'Advent: Waiting Well', 'series', 3, 'confirmed', { month: 4, tags: ['jesus', 'prophets'], refs: 'Isaiah 9; Luke 1–2', bigIdea: 'God keeps promises slowly.' }),
  I('teach', 0, 'Genesis to Judges', 'series', 10, 'confirmed', { month: 5, tags: ['torah', 'god', 'scripture'], refs: 'Genesis–Judges', bigIdea: 'The story starts long before us.' }),
  I('teach', 0, 'HABITS', 'series', 6, 'confirmed', { month: 8, tags: ['prayer', 'bible', 'service'], bigIdea: 'Following Jesus has a shape you can practice.' }),
  I('teach', 0, 'Summer in the Psalms', 'series', 6, 'draft', { month: 10, tags: ['psalms', 'prayer'], refs: 'Psalm 1, 23, 51, 139' }),
  I('teach', 1, 'Who Do You Say I Am', 'series', 8, 'draft', { tags: ['jesus', 'gospels', 'identity'] }),
  I('teach', 1, 'Kings & Prophets', 'series', 10, 'draft', { tags: ['prophets', 'torah', 'god'] }),
  I('teach', 1, 'Sent', 'series', 6, 'draft', { tags: ['witness', 'acts', 'service'] }),
  I('teach', 2, 'Gospel of Mark', 'series', 8, 'draft', { tags: ['gospels', 'jesus'] }),
  I('events', 0, 'Fall kickoff', 'event', 1, 'confirmed', { month: 1, debrief: { worked: 'Parents stayed for the first half hour.', change: 'Registration line ran 25 minutes. Pre-register online.' } }),
  I('events', 0, 'All-nighter', 'event', 1, 'confirmed', { month: 5 }),
  I('events', 1, 'Fall kickoff', 'event', 1, 'draft', { month: 1 }),
  I('groups', 0, 'Small groups launch', 'milestone', 3, 'confirmed', { month: 1 }),
  I('groups', 0, 'Group leader huddles', 'recurring', 9, 'confirmed', { debrief: { worked: 'Ten minutes before doors, standing, one question.', change: '' } }),
  I('groups', 1, 'Group leader huddles', 'recurring', 9, 'draft'),
  I('lead', 0, 'Student leadership team', 'milestone', 6, 'confirmed', { month: 2 }),
  I('vtrain', 0, 'August training day', 'event', 1, 'confirmed', { month: 0, debrief: { worked: 'Role-play of the hard conversation.', change: 'Split new and returning volunteers after lunch.' } }),
  I('vtrain', 1, 'August training day', 'event', 1, 'draft', { month: 0 }),
  I('vcare', 0, 'Volunteer appreciation dinner', 'event', 1, 'confirmed', { month: 4 }),
  I('parents', 0, 'Parent night', 'event', 1, 'confirmed', { month: 2, debrief: { worked: '', change: 'Nobody came in October. Tie it to the kickoff instead.' } }),
  I('parents', 0, 'Monthly parent letter', 'recurring', 12, 'confirmed'),
  I('outreach', 0, 'Serve week', 'event', 5, 'confirmed', { month: 10 }),
  I('trips', 0, 'Fall retreat', 'trip', 3, 'confirmed', { month: 3, debrief: { worked: 'Saturday free afternoon.', change: 'Three weeks of promo was not enough for new families.' } }),
  I('trips', 0, 'Summer camp', 'trip', 5, 'confirmed', { month: 11 }),
  I('trips', 1, 'Summer camp', 'trip', 5, 'draft', { month: 11 }),
  I('promo', 0, 'Invite night push', 'event', 2, 'confirmed', { month: 1 }),
  I('admin', 0, 'Retreat deposits due', 'milestone', 1, 'confirmed', { month: 2 }),
  I('admin', 0, 'Background check renewals', 'milestone', 2, 'confirmed', { month: 0 }),
  I('goals', 0, 'Nine in ten 6th graders in a small group', 'goal', 12, 'confirmed', { supports: ['groups'] }),
  I('goals', 2, 'Every senior has a mentor', 'goal', 12, 'draft', { supports: ['lead', 'vcare'] })
];

export function demoPlan(now: number): Plan {
  const p = emptyPlan(2026, 3);
  p.settings = { ...p.settings, name: 'Grace Students · 2026–2033', campus: 'Main campus', liturgical: true };
  p.settings.blackouts = [
    ['2026-11-23', '2026-11-29'],
    ['2026-12-19', '2027-01-03'],
    ['2027-03-15', '2027-03-21'],
    ['2027-06-28', '2027-07-04']
  ];
  p.items = ITEMS.map((it, i) => ({ ...it, id: 'pi' + (i + 1) }));
  p.blocks = p.blocks.map((b) => (b.id === 'ministry' ? { ...b, on: true } : b));
  const leads: Record<string, string> = { setup: 'Sam Okafor', huddle: 'Mike Torres', doors: 'Renee Boyd', game: 'Sam Okafor', worship: 'Priya Raman', teaching: 'Mike Torres', ministry: 'Priya Raman', groups: 'Chris Alder', sendoff: 'Mike Torres', teardown: 'Ty Winslow', debrief: 'Mike Torres' };
  const order = p.blocks.filter((b) => b.on).map((b) => ({ id: b.id, seg: b.seg, kind: b.name, title: b.id === 'game' ? 'Pipeline relay' : '', mins: b.mins, lead: leads[b.id] ?? null }));
  p.gatherings['2026-10-21'] = {
    order: order.map((b) => ({ ...b, title: b.id === 'game' ? 'Dodgeball' : b.title })),
    debrief: {
      answers: { wins: 'Dodgeball pulled the new 6th graders in fast. Two of them stayed for small group.', problems: 'Teaching ran six minutes long again; small groups got squeezed.', who: 'Wyatt — third week leaving before the Word.', leaders: 'Dana is stretched thin covering two groups.' },
      actual: { teaching: 31, groups: 24, game: 18 },
      at: now - 7 * 86_400_000,
      by: 'Pastor Mike'
    }
  };
  p.gatherings['2026-10-28'] = {
    order,
    practices: [
      { id: 'pr1', name: 'Band rehearsal', day: -1, start: '19:00', mins: 90, people: ['Priya Raman', 'Ava Lin'] },
      { id: 'pr2', name: 'Game run-through', day: 0, start: '17:30', mins: 30, people: ['Sam Okafor'] }
    ],
    brief: 'Week 9 of 9 — last night of the season. Name what the season was about before small groups.',
    live: {
      acts: [
        { id: 'lv1', type: 'trivia', prompt: 'Who wrote the letter to the Ephesians?', options: [{ l: 'Peter' }, { l: 'Paul', correct: true }, { l: 'John' }, { l: 'Luke' }], timer: 'night' },
        { id: 'lv2', type: 'this', prompt: 'Harder to believe this week?', options: [{ l: 'God chose me' }, { l: 'God isn’t done with me' }], timer: 'night' },
        { id: 'lv3', type: 'cloud', prompt: 'One word for this season', timer: 30 },
        { id: 'lv4', type: 'verse', prompt: 'Finish Ephesians 2:8', verse: 'For by [grace] are ye saved through [faith]; and that not of yourselves: it is the gift of God.', timer: 30 },
        { id: 'lv5', type: 'tug', prompt: 'Tug-of-war: pull for your squads', timer: 30 }
      ]
    }
  };
  p.gatherings['2026-10-21'].live = {
    acts: [
      { id: 'lw1', type: 'trivia', prompt: 'Which city was Paul writing to?', options: [{ l: 'Ephesus', correct: true }, { l: 'Corinth' }, { l: 'Rome' }], timer: 'night' },
      { id: 'lw2', type: 'cloud', prompt: 'One word for how this week felt', timer: 'night' }
    ],
    decided: { tired: true, busy: true, hopeful: true },
    results: {
      at: now - 7 * 86_400_000 + 3_600_000,
      by: 'Pastor Mike',
      lines: [
        { id: 'lw1', type: 'trivia', prompt: 'Which city was Paul writing to?', line: '71% chose Ephesus · 24 answered' },
        { id: 'lw2', type: 'cloud', prompt: 'One word for how this week felt', line: 'Top words: tired, busy, hopeful · 3 approved' }
      ]
    }
  };
  p.published = { at: now - 20 * 86_400_000, by: 'Pastor Mike', items: Object.fromEntries(p.items.filter((x) => x.year === 0 && x.status === 'confirmed' && x.title !== 'Summer camp').map((x) => [x.id, x.title + '|' + x.lane + '|' + (x.month ?? '') + '|' + x.size])) };
  p.dismissed = [{ id: 'cov:sexuality|2031', reason: 'This class had the full weekend retreat on this in 2029, before the plan started tracking it.', at: now - 40 * 86_400_000, by: 'Pastor Mike' }];
  return p;
}
