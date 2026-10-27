/* "Build from this week's lesson": Claude drafts a small-group guide, a
   challenge for each squad and a five-day go-deeper week from whatever the
   leader has — a manuscript, an outline, a passage or just a topic. The
   same rules as the planner's ideas: suggest, never act (nothing saves
   until a leader approves it); passages as references only, never quoted
   (the leader adds the text in their own translation); no invented
   resources, videos or quotations.

   This module is pure: what Claude is told, the shape it answers in, and
   the checks every answer passes. The call is on the server
   (lib/server/small-group-ai.ts). */
import { z } from 'zod';
import { QUOTE, REF } from '@/lib/plan-ai';
import type { Challenge, SmallGroup, SmallGroupScreen } from '@/lib/types/model';

/** Screen types Claude may use: not video (it would need a real link) and
 *  not the spinner (it needs the squad's names). */
export const DRAFT_TYPES = ['thought', 'scripture', 'game', 'pass', 'poll', 'checklist', 'timer', 'prayer', 'wyr'] as const;

export const DraftSchema = z.object({
  title: z.string(),
  notes: z.string(),
  screens: z.array(
    z.object({
      type: z.enum(DRAFT_TYPES),
      title: z.string(),
      body: z.string(),
      ref: z.string().nullable(),
      options: z.array(z.string()).nullable(),
      items: z.array(z.string()).nullable(),
      timer_seconds: z.number().int().nullable()
    })
  ),
  challenges: z.array(z.object({ squad: z.string(), title: z.string(), description: z.string() })),
  deep_dive: z.object({
    title: z.string(),
    verse_ref: z.string(),
    student_ask: z.string(),
    leader_prep: z.string(),
    days: z.array(z.object({ day: z.string(), ref: z.string(), prompt: z.string() }))
  })
});
export type RawDraft = z.infer<typeof DraftSchema>;

export const SG_SYSTEM = [
  'You help a youth pastor turn this week’s lesson into a small-group guide that coaches and captains play screen by screen on a phone after the game.',
  'Rules you must keep:',
  '- Suggest only. A leader reviews and edits everything before anyone sees it.',
  '- Cite passages as references only (for example "Ephesians 2:8–10"). Never quote scripture or any other text: on a scripture screen, the body says what to do with the passage (for example "Read it aloud, one verse each"); the leader adds the text in their translation.',
  '- Never invent resources, curricula, books, authors, videos, statistics or quotations.',
  '- Build on the leader’s own lesson. Stay within the church’s tradition where it is given; otherwise stay with what Christians broadly hold in common.',
  '- Write for the grades in the room, in plain words a coach can read out loud. Keep every screen short.',
  '- Fit the minutes given. Mix kinds of screens: something to open, the passage, a question passed around, and something to take home.',
  '- Give one squad challenge per squad named, each a small, doable action for the week tied to the lesson.',
  '- The go-deeper week is five days, Monday to Friday, each a passage reference and one question to write about.'
].join('\n');

export interface DraftInput {
  mode: 'text' | 'passage' | 'topic';
  lesson: string;
  minutes: number;
  room: string;
  squads: string[];
  week: number;
  ministry: string;
  tradition?: string;
}

export function draftBrief(i: DraftInput): string {
  const what = i.mode === 'text' ? 'The lesson as the leader has it so far (it may be a manuscript, an outline or a few bullets):' : i.mode === 'passage' ? 'The passage the lesson is on:' : 'The topic of the lesson:';
  return [
    'Ministry: ' + i.ministry + (i.tradition ? ' (' + i.tradition + ')' : ''),
    'Week ' + i.week + '. Small group time: about ' + i.minutes + ' minutes. Room: ' + i.room + '.',
    'Squads: ' + (i.squads.join(', ') || 'none named'),
    '',
    what,
    i.lesson.trim().slice(0, 20_000),
    '',
    'Write the guide: a title and a one-line note for coaches; the screens; one challenge per squad; and the five-day go-deeper week.'
  ].join('\n');
}

export interface Draft {
  group: SmallGroup;
  challenges: Challenge[];
  /** Screens or challenges that broke a rule and were left out. */
  dropped: number;
}

const short = (s: string, n: number) => s.trim().replace(/\s+/g, ' ').slice(0, n);
const clean = (xs: string[] | null, n: number) => (xs ?? []).map((x) => short(x, 80)).filter(Boolean).slice(0, n);

/** Every part passes these before a leader sees it; one that doesn't is
 *  dropped, never repaired into something Claude didn't say. */
export function cleanDraft(raw: RawDraft, ctx: { week: number; teams: { id: string; name: string }[]; id: () => string }): Draft {
  let dropped = 0;
  const screens: SmallGroupScreen[] = [];
  for (const s of raw.screens.slice(0, 10)) {
    const text = s.title + ' ' + s.body + ' ' + (s.options ?? []).join(' ') + ' ' + (s.items ?? []).join(' ');
    if (!s.title.trim() || QUOTE.test(text) || s.body.length > 400) {
      dropped++;
      continue;
    }
    const sc: SmallGroupScreen = { id: ctx.id(), type: s.type, title: short(s.title, 80), body: s.body.trim() };
    if (s.type === 'scripture') {
      const ref = (s.ref ?? '').trim();
      if (!REF.test(ref)) {
        dropped++;
        continue;
      }
      sc.ref = ref;
    }
    if (s.type === 'poll' || s.type === 'wyr') {
      sc.options = clean(s.options, 6);
      if (sc.options.length < 2) {
        dropped++;
        continue;
      }
    }
    if (s.type === 'checklist') sc.items = clean(s.items, 8);
    if (s.type === 'timer') sc.timerSeconds = Math.max(30, Math.min(900, s.timer_seconds ?? 120));
    screens.push(sc);
  }
  const challenges: Challenge[] = [];
  for (const c of raw.challenges) {
    const team = ctx.teams.find((t) => t.name.toLowerCase() === c.squad.trim().toLowerCase());
    if (!team || challenges.some((x) => x.team === team.id) || QUOTE.test(c.title + ' ' + c.description) || !c.title.trim()) {
      dropped++;
      continue;
    }
    challenges.push({ id: ctx.id(), kind: 'Team', title: short(c.title, 80), body: short(c.description, 280), pointsLabel: '', status: 'Not started', done: false, team: team.id, weeks: [ctx.week] });
  }
  const dd = raw.deep_dive;
  const days = dd.days.filter((x) => REF.test(x.ref.trim()) && !QUOTE.test(x.prompt)).slice(0, 5);
  const deepOk = days.length === 5 && REF.test(dd.verse_ref.trim()) && !QUOTE.test(dd.student_ask + ' ' + dd.leader_prep);
  if (!deepOk) dropped++;
  const group: SmallGroup = {
    id: ctx.id(),
    title: short(raw.title, 80) || 'Week ' + ctx.week + ' small group',
    notes: short(raw.notes, 240),
    screens,
    weekNumber: ctx.week,
    ...(deepOk
      ? {
          deepDive: {
            title: short(dd.title, 80),
            verseRef: dd.verse_ref.trim(),
            verseText: '',
            studentAsk: dd.student_ask.trim(),
            leaderPrep: dd.leader_prep.trim(),
            days: days.map((x, k) => ({ day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][k], ref: x.ref.trim(), prompt: short(x.prompt, 280) }))
          }
        }
      : {})
  };
  return { group, challenges, dropped };
}
