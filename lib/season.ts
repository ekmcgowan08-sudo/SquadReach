/* The season interview: seventeen questions in the order a pastor thinks
   about a season, one per screen. Every question is skippable and every skip
   is visible — an unanswered question uses its fallback and the review tags
   it "default", because the failure mode of a setup wizard is approving
   answers nobody gave.

   Saving writes the settings the answers imply (dates, growth, the verse
   board, the parent board, game weeks). Answers the app can't apply by
   itself say where they're set instead of pretending. Adding a question is
   one entry here. */
import { isoDay, parseLocalISO, tonightDate, weekOf } from '@/lib/dates';
import type { MinistryConfig } from '@/lib/types/model';

export type SeasonAnswer = string | number | string[];
export type SeasonAnswers = Record<string, SeasonAnswer>;

export interface SeasonQuestion {
  id: string;
  group: string;
  kind: 'choice' | 'multi' | 'text' | 'number' | 'date';
  q: string;
  help?: string;
  placeholder?: string;
  options?: { value: string | number; label: string; note?: string }[];
  min?: number;
  max?: number;
  fallback: SeasonAnswer;
  /** Where this answer lands when the app doesn't apply it itself. */
  setIn?: { label: string; href: string };
}

export interface SavedSeason {
  id: string;
  name: string;
  answers: SeasonAnswers;
  active: boolean;
  savedAt: number;
}

export const SEASON_GROUPS = [
  { id: 'basics', label: 'The basics' },
  { id: 'scoring', label: 'How points work' },
  { id: 'squads', label: 'Squads' },
  { id: 'rhythm', label: 'The rhythm of a night' },
  { id: 'people', label: 'Who can do what' },
  { id: 'comms', label: 'What goes out' }
] as const;

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const SEASON_QUESTIONS: SeasonQuestion[] = [
  { id: 'name', group: 'basics', kind: 'text', q: 'What are you calling this season?', help: 'Students see this name on the board all season.', placeholder: 'Fall 2026', fallback: 'Fall season' },
  { id: 'start', group: 'basics', kind: 'date', q: 'What night does it start?', help: 'Week 1. Every week number in the app counts from here.', fallback: '' },
  { id: 'weeks', group: 'basics', kind: 'number', q: 'How many weeks long?', help: 'Most ministries run 8 to 12. Nine is the most common.', min: 3, max: 26, fallback: 9 },
  { id: 'night', group: 'basics', kind: 'choice', q: 'Which night do you meet?', options: DAYS.map((d) => ({ value: d, label: d })), fallback: 'Wednesday' },
  {
    id: 'carry', group: 'scoring', kind: 'choice', q: 'Will points add up over the whole season?',
    help: 'A season-long total makes every week matter. A weekly reset gives anyone a chance to win tonight.',
    options: [
      { value: 'season', label: 'Yes — one running total all season', note: 'Squads chase a season championship.' },
      { value: 'weekly', label: 'No — points reset every week', note: 'Each week is its own contest.' },
      { value: 'both', label: 'Both — a season board and a week board', note: 'Two leaderboards. Most ministries end up here.' },
      { value: 'none', label: 'No points at all — regular programming', note: 'No leaderboard. The app runs as huddles, run of show and follow-up.' }
    ],
    fallback: 'both', setIn: { label: 'Scoring', href: '/console?tab=scoring' }
  },
  {
    id: 'growth', group: 'scoring', kind: 'choice', q: 'Are later weeks worth more than early ones?',
    help: 'Growing the point base keeps a slow start from deciding the season in week two.',
    options: [
      { value: 8, label: 'Yes — 8% more each week', note: 'The default. Week 9 is worth about double week 1.' },
      { value: 15, label: 'Yes — 15% more each week', note: 'Aggressive. Late weeks dominate.' },
      { value: 0, label: 'No — every week is worth the same' }
    ],
    fallback: 8
  },
  {
    id: 'earn', group: 'scoring', kind: 'multi', q: 'What earns points this season?',
    help: 'Pick everything you want to count. Anything not in a category won’t show up in a report.',
    options: [
      { value: 'attendance', label: 'Showing up' }, { value: 'friend', label: 'Bringing a friend' }, { value: 'verse', label: 'Reciting a verse' },
      { value: 'serving', label: 'Serving or volunteering' }, { value: 'smallgroup', label: 'Small group participation' }, { value: 'game', label: 'Winning the game' },
      { value: 'devotion', label: 'Devotions or articles read' }, { value: 'worship', label: 'Worship attendance' }, { value: 'bible', label: 'Bringing a Bible' },
      { value: 'invite', label: 'Inviting on social' }
    ],
    fallback: ['attendance', 'friend', 'verse', 'serving', 'game'], setIn: { label: 'Scoring · categories', href: '/console?tab=scoring' }
  },
  {
    id: 'verses', group: 'scoring', kind: 'choice', q: 'Are you memorizing verses this season?',
    options: [
      { value: 'weekly', label: 'Yes — a new verse every week', note: 'The verse board opens and pays points.' },
      { value: 'optional', label: 'Yes, but optional', note: 'Posted, worth points, never required.' },
      { value: 'off', label: 'Not this season' }
    ],
    fallback: 'weekly'
  },
  { id: 'squadCount', group: 'squads', kind: 'number', q: 'How many squads?', help: 'Four is the sweet spot for 40 to 120 students.', min: 2, max: 12, fallback: 4, setIn: { label: 'Squads', href: '/console?tab=teams' } },
  { id: 'squadNames', group: 'squads', kind: 'text', q: 'What are the squads called?', help: 'Comma separated. Colors are the easiest thing for a 6th grader to remember.', placeholder: 'Red, Blue, Yellow, Green', fallback: 'Red, Blue, Yellow, Green', setIn: { label: 'Squads', href: '/console?tab=teams' } },
  {
    id: 'assign', group: 'squads', kind: 'choice', q: 'How do students end up on a squad?',
    options: [
      { value: 'draft', label: 'Draft night — captains pick' },
      { value: 'pastor', label: 'I assign them', note: 'You balance grade and gender by hand.' },
      { value: 'random', label: 'Random, balanced by grade' },
      { value: 'keep', label: 'They keep last season’s squad', note: 'Rivalries carry over.' }
    ],
    fallback: 'pastor', setIn: { label: 'Squads', href: '/console?tab=teams' }
  },
  {
    id: 'game', group: 'rhythm', kind: 'choice', q: 'Do you play a game every week?',
    options: [{ value: 'every', label: 'Every week' }, { value: 'some', label: 'Some weeks' }, { value: 'none', label: 'No games this season' }],
    fallback: 'every'
  },
  {
    id: 'smallGroup', group: 'rhythm', kind: 'choice', q: 'Small group after the game?', help: 'If yes, the app carries a guide per week that leaders play screen by screen.',
    options: [{ value: 'yes', label: 'Yes — every week' }, { value: 'some', label: 'Some weeks' }, { value: 'no', label: 'No small group' }],
    fallback: 'yes', setIn: { label: 'Season & small groups', href: '/dashboard/season-plan?tab=groups' }
  },
  {
    id: 'awards', group: 'rhythm', kind: 'choice', q: 'How are the end-of-season awards decided?',
    options: [
      { value: 'both', label: 'Both — some by points, some voted', note: 'Most ministries. Trophy night has range.' },
      { value: 'points', label: 'By points only', note: 'No campaigning, no popularity contest.' },
      { value: 'vote', label: 'Students vote on all of them' }
    ],
    fallback: 'both', setIn: { label: 'Awards', href: '/dashboard/awards' }
  },
  {
    id: 'scorers', group: 'people', kind: 'multi', q: 'Who can put points on the board?',
    help: 'Anyone not listed can still submit — it waits in your approval queue with proof attached.',
    options: [
      { value: 'pastor', label: 'Me, the youth pastor' }, { value: 'scorekeeper', label: 'The scorekeeper' }, { value: 'coaches', label: 'Coaches, for their own squad' },
      { value: 'captains', label: 'Captains' }, { value: 'leaders', label: 'Small group leaders' }
    ],
    fallback: ['pastor', 'scorekeeper', 'coaches'], setIn: { label: 'People & roles', href: '/console?tab=people' }
  },
  {
    id: 'parents', group: 'people', kind: 'choice', q: 'Do parents get a read-only board?', help: 'A link, no login. Standings and the verse, never a full name.',
    options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }],
    fallback: 'yes'
  },
  {
    id: 'reports', group: 'comms', kind: 'multi', q: 'What should go out automatically?', help: 'Recipients are worked out when it sends, so a trade never leaves a stale list behind.',
    options: [
      { value: 'roster', label: 'Each coach their own roster' }, { value: 'weekly', label: 'Weekly recap to leaders' }, { value: 'visitors', label: 'New friends follow-up list, to me' },
      { value: 'standings', label: 'Standings to parents' }, { value: 'attendance', label: 'Attendance to church staff' }
    ],
    fallback: ['roster', 'weekly', 'visitors'], setIn: { label: 'Reports', href: '/console?tab=reports' }
  }
];

export const seasonAnswered = (a: SeasonAnswers, id: string) => {
  const v = a[id];
  return v !== undefined && v !== '' && !(Array.isArray(v) && !v.length);
};

/** The answer, or the fallback a skip falls back to. */
export function answerOf(a: SeasonAnswers, q: SeasonQuestion, today: string): SeasonAnswer {
  if (seasonAnswered(a, q.id)) return a[q.id];
  if (q.id === 'start') return nextWeekday(today, String(answerOf(a, SEASON_QUESTIONS.find((x) => x.id === 'night')!, today)));
  return q.fallback;
}

export function answerLabel(q: SeasonQuestion, v: SeasonAnswer): string {
  if (q.kind === 'multi') {
    const list = (v as string[]).map((x) => q.options?.find((o) => o.value === x)?.label ?? x);
    return list.length ? list.join(', ') : 'Nothing';
  }
  if (q.kind === 'choice') return q.options?.find((o) => o.value === v)?.label ?? String(v);
  if (q.kind === 'date') {
    const d = parseLocalISO(String(v));
    return d ? d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : String(v);
  }
  return String(v);
}

/** The first given weekday on or after `iso`. */
export function nextWeekday(iso: string, day: string): string {
  const d = parseLocalISO(iso) ?? new Date();
  const want = Math.max(0, DAYS.indexOf(day));
  while (d.getDay() !== want) d.setDate(d.getDate() + 1);
  return isoDay(d);
}

/** The settings a set of answers implies. Only what the app runs by itself. */
export function seasonSettings(a: SeasonAnswers, cfg: MinistryConfig, today: string): Partial<MinistryConfig> {
  const get = (id: string) => answerOf(a, SEASON_QUESTIONS.find((q) => q.id === id)!, today);
  const weeks = Math.max(3, Math.min(26, Number(get('weeks')) || 9));
  const first = nextWeekday(String(get('start')), String(get('night')));
  const start = parseLocalISO(first)!;
  const meetingDates = Array.from({ length: weeks }, (_, i) => isoDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i * 7)));
  const verses = String(get('verses'));
  const game = String(get('game'));
  const parents = String(get('parents')) === 'yes';
  return {
    seasonName: String(get('name')).trim() || 'Season',
    seasonWeeks: weeks,
    meetingDates,
    weekNumber: weekOf(meetingDates, tonightDate(meetingDates, parseLocalISO(today) ?? new Date())),
    weekGrowthPct: Number(get('growth')) || 0,
    verseBoard: verses === 'off' ? 0 : cfg.verseBoard || 25,
    gameSetup: { ...cfg.gameSetup, gameWeeks: game === 'none' ? [] : game === 'every' ? null : cfg.gameSetup.gameWeeks },
    parentShare: parents ? { ...cfg.parentShare, standings: true } : { standings: false, mvp: false, verse: false, photos: false, calendar: false }
  };
}

/** "Fall 2025" → "Fall 2026"; anything else gets " (next)". */
export function nextSeasonName(name: string): string {
  const m = /(\d{4})/.exec(name);
  return m ? name.replace(m[1], String(Number(m[1]) + 1)) : name + ' (next)';
}
