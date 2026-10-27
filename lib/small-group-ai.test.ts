import { describe, expect, it } from 'vitest';
import { cleanDraft, draftBrief, type RawDraft } from '@/lib/small-group-ai';

let n = 0;
const id = () => 'id' + ++n;
const teams = [
  { id: 'red', name: 'Red' },
  { id: 'blue', name: 'Blue' }
];
const raw = (over: Partial<RawDraft> = {}): RawDraft => ({
  title: 'Made on purpose',
  notes: 'Split by grade if the room is big.',
  screens: [
    { type: 'thought', title: 'Open', body: 'What’s something you made that you were proud of?', ref: null, options: null, items: null, timer_seconds: null },
    { type: 'scripture', title: 'Read it', body: 'Read it aloud, one verse each.', ref: 'Ephesians 2:8–10', options: null, items: null, timer_seconds: null },
    { type: 'poll', title: 'Vote', body: 'Which is harder?', options: ['Believing it', 'Living it'], ref: null, items: null, timer_seconds: null },
    { type: 'pass', title: 'Pass it', body: 'Pass the phone. Each person: “I was made to…”', ref: null, options: null, items: null, timer_seconds: null }
  ],
  challenges: [
    { squad: 'Red', title: 'Do one good work nobody sees', description: 'Each person does one, and tells the squad next week.' },
    { squad: 'Green', title: 'Not a squad here', description: 'Dropped.' },
    { squad: 'blue', title: 'Thank someone who made you', description: 'A note or a text to a parent or teacher.' }
  ],
  deep_dive: {
    title: 'Five days in Ephesians 2',
    verse_ref: 'Ephesians 2:10',
    student_ask: 'Write one line a day about what God made you for.',
    leader_prep: 'Read the whole chapter twice before Wednesday.',
    days: ['Ephesians 2:1–3', 'Ephesians 2:4–7', 'Ephesians 2:8–9', 'Ephesians 2:10', 'Ephesians 2:11–22'].map((ref) => ({ day: 'x', ref, prompt: 'What does this say God did?' }))
  },
  ...over
});

describe('Claude’s small-group drafts', () => {
  it('briefs with the lesson, the room and the squads', () => {
    const b = draftBrief({ mode: 'passage', lesson: 'Ephesians 2', minutes: 30, room: 'High school 9–12', squads: ['Red', 'Blue'], week: 9, ministry: 'Grace Community Students' });
    expect(b).toContain('The passage the lesson is on:');
    expect(b).toContain('Squads: Red, Blue');
    expect(b).toContain('about 30 minutes');
  });

  it('keeps a good draft: screens, one challenge per known squad, a five-day week', () => {
    const d = cleanDraft(raw(), { week: 9, teams, id });
    expect(d.group.weekNumber).toBe(9);
    expect(d.group.screens.map((s) => s.type)).toEqual(['thought', 'scripture', 'poll', 'pass']);
    expect(d.group.screens[1].ref).toBe('Ephesians 2:8–10');
    expect(d.challenges.map((c) => c.team)).toEqual(['red', 'blue']);
    expect(d.challenges[0].weeks).toEqual([9]);
    expect(d.group.deepDive?.days.map((x) => x.day)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    expect(d.group.deepDive?.verseText).toBe('');
    expect(d.dropped).toBe(1);
  });

  it('drops a screen that quotes text, a scripture screen without a real reference, and a poll with one option', () => {
    const d = cleanDraft(
      raw({
        screens: [
          { type: 'thought', title: 'Quote', body: 'As the verse says, “For we are his workmanship, created in Christ Jesus”.', ref: null, options: null, items: null, timer_seconds: null },
          { type: 'scripture', title: 'Read', body: 'Read it.', ref: 'somewhere in Paul', options: null, items: null, timer_seconds: null },
          { type: 'poll', title: 'Vote', body: 'Pick', options: ['Only one'], ref: null, items: null, timer_seconds: null },
          { type: 'timer', title: 'Quiet', body: 'Two minutes of quiet.', ref: null, options: null, items: null, timer_seconds: 5000 }
        ]
      }),
      { week: 3, teams, id }
    );
    expect(d.group.screens.map((s) => s.type)).toEqual(['timer']);
    expect(d.group.screens[0].timerSeconds).toBe(900);
  });

  it('leaves out the go-deeper week unless all five days cite a passage', () => {
    const r = raw();
    r.deep_dive.days[2].ref = 'Day three';
    expect(cleanDraft(r, { week: 1, teams, id }).group.deepDive).toBeUndefined();
  });
});
