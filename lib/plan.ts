/* The planner: seven ministry years (6th grade through 12th), each cut into
   seasons, each season into gathering nights. It references the app's own
   records rather than copying them — tonight's run sheet is the huddle's,
   the volunteer schedule is Serving's, attendance is the ledger's — and
   everything derived (which series a night teaches, coverage, checks) is
   computed when it's read, never stored.

   Ministry year Y runs August 1 of startYear + Y to July 31 the year after. */
import type { LiveActivity, LiveKind, LiveSettings } from '@/lib/live';
import { addDays, advent1, easter, weekdayOf, ymd } from '@/lib/liturgical';

export type ItemKind = 'series' | 'event' | 'trip' | 'milestone' | 'recurring' | 'goal';

export interface PlanLane {
  id: string;
  name: string;
  short: string;
  /** OKLCH hue; every lane shares one lightness and chroma. */
  hue: number;
  on: boolean;
}

export interface PlanItem {
  id: string;
  lane: string;
  /** 0–6: which ministry year. */
  year: number;
  title: string;
  kind: ItemKind;
  /** Weeks for a series, days for an event or trip. */
  size: number;
  status: 'confirmed' | 'draft';
  /** Optional start month within the ministry year: 0 = August … 11 = July. */
  month?: number;
  notes: string;
  /** Coverage categories this teaching carries (lib/coverage CATS). */
  tags: string[];
  /** Scripture a series works through, as plain references. */
  refs?: string;
  bigIdea?: string;
  debrief?: { worked: string; change: string };
  /** Offered by Suggestions; a leader confirms it. */
  suggested?: { reason: string; rule: string; cites: string[] };
  /** Planned again from an earlier run. */
  source?: string;
  /** For a goal: the lanes whose activity supports it. */
  supports?: string[];
}

export type SeasonAnchor = { kind: 'date'; month: number; day: number } | { kind: 'advent' } | { kind: 'ash' } | { kind: 'easter'; offset: number };

export interface PlanSeason {
  id: string;
  name: string;
  note: string;
  /** Starts on the first gathering night on or after this. */
  start: SeasonAnchor;
  on: boolean;
}

export interface BlockDef {
  id: string;
  name: string;
  note: string;
  mins: number;
  seg: 'pre' | 'main' | 'post';
  on: boolean;
}

export interface OrderBlock {
  id: string;
  seg: 'pre' | 'main' | 'post';
  kind: string;
  title: string;
  mins: number;
  lead: string | null;
}

export interface Practice {
  id: string;
  name: string;
  /** Days from the gathering: -1 the night before. */
  day: number;
  start: string;
  mins: number;
  people: string[];
}

export interface GatheringPlan {
  /** The night's service order; absent means the template. */
  order?: OrderBlock[];
  practices?: Practice[];
  /** Notes for leaders that aren't a block. */
  brief?: string;
  debrief?: {
    answers: Record<string, string>;
    /** Block id → minutes it actually ran. Blank blocks ran to plan. */
    actual: Record<string, number>;
    at: number;
    by: string;
    carriedTo?: string;
    carriedFrom?: string;
  };
  /** Live ministry time: the night's activities (with their answers, so
   *  leaders only), and what they showed once attached to the debrief. */
  live?: {
    acts: LiveActivity[];
    /** Word-cloud words a leader showed (true) or kept off the screen. */
    decided?: Record<string, boolean>;
    results?: { at: number; by: string; lines: { id: string; type: LiveKind; prompt: string; line: string }[] };
  };
}

export interface PlanSettings {
  name: string;
  campus: string;
  /** The August that starts year one. */
  startYear: number;
  /** 0 = Sunday … 6 = Saturday. */
  gatherDay: number;
  /** The grade students enter at; seven years means through 12th from 6th. */
  entryGrade: number;
  /** [from, to] inclusive local dates with no gathering. */
  blackouts: [string, string][];
  liturgical: boolean;
  translation: string;
  /** From the setup: the groups the ministry runs, by grade. */
  groups?: { name: string; low: number; high: number }[];
  church?: string;
  denomination?: string;
  tradition?: string;
  doctrine?: string;
  values?: string;
  /** What should be true of a graduate; coverage is read against these. */
  outcomes?: string[];
  setupAt?: number;
}

export interface Plan {
  settings: PlanSettings;
  lanes: PlanLane[];
  seasons: PlanSeason[];
  blocks: BlockDef[];
  debriefQs: { id: string; q: string; note: string; on: boolean }[];
  items: PlanItem[];
  gatherings: Record<string, GatheringPlan>;
  /** What the app last showed: item id → a signature of what was shown. */
  published: { at: number; by: string; items: Record<string, string> } | null;
  /** Checks and suggestions a leader set aside, with their reason. */
  dismissed: { id: string; reason: string; at: number; by: string }[];
  /** Liturgical days in use (all on by default once the layer is on). */
  holyDays: Record<string, boolean>;
  changes: { id: string; at: number; by: string; line: string }[];
  /** Live ministry time's night defaults; absent means LIVE_DEFAULTS. */
  live?: LiveSettings;
}

export const LANE_DEFAULTS: PlanLane[] = [
  { id: 'teach', name: 'Teaching', short: 'Teaching', hue: 292, on: true },
  { id: 'events', name: 'Student events', short: 'Events', hue: 330, on: true },
  { id: 'groups', name: 'Discipleship & small groups', short: 'Groups', hue: 208, on: true },
  { id: 'lead', name: 'Student leadership', short: 'Student leaders', hue: 258, on: true },
  { id: 'vtrain', name: 'Volunteer meetings & training', short: 'Volunteer training', hue: 168, on: true },
  { id: 'vcare', name: 'Volunteer care & recruitment', short: 'Volunteer care', hue: 138, on: true },
  { id: 'parents', name: 'Parent meetings & communication', short: 'Parents', hue: 42, on: true },
  { id: 'outreach', name: 'Outreach & service', short: 'Outreach', hue: 96, on: true },
  { id: 'trips', name: 'Trips, retreats & camps', short: 'Trips & camps', hue: 18, on: true },
  { id: 'promo', name: 'Promotion & social', short: 'Promotion', hue: 312, on: true },
  { id: 'admin', name: 'Admin deadlines', short: 'Admin', hue: 240, on: true },
  { id: 'goals', name: 'Goals & evaluation', short: 'Goals', hue: 62, on: true }
];

export const TRANSLATIONS = ['KJV', 'ASV', 'RVR1909', 'NIV', 'ESV', 'CSB', 'NLT', 'NRSVue', 'NASB', 'NKJV'];
export const TRADITIONS = ['Not specified', 'Evangelical', 'Reformed', 'Wesleyan / Methodist', 'Baptist', 'Anglican', 'Lutheran', 'Pentecostal / Charismatic', 'Catholic', 'Orthodox', 'Restorationist', 'Other'];

export const HUES = [292, 330, 208, 258, 168, 138, 42, 96, 18, 312, 240, 62];
export const laneColor = (hue: number) => 'oklch(0.63 0.085 ' + hue + ')';

export const SEASON_DEFAULTS: PlanSeason[] = [
  { id: 'fall', name: 'Fall', note: 'Groups launch, leaders are new, and the teaching sets the frame.', start: { kind: 'date', month: 8, day: 1 }, on: true },
  { id: 'advent', name: 'Advent & Christmas', note: 'Short and interrupted — worth planning tightly.', start: { kind: 'advent' }, on: true },
  { id: 'winter', name: 'Winter', note: 'The quietest window and the best one for depth.', start: { kind: 'date', month: 1, day: 1 }, on: true },
  { id: 'lent', name: 'Lent & Easter', note: 'The arc runs toward Easter and lands the week after.', start: { kind: 'ash' }, on: true },
  { id: 'spring', name: 'Spring', note: 'Seniors leave and the next class arrives. Name both out loud.', start: { kind: 'easter', offset: 14 }, on: true },
  { id: 'summer', name: 'Summer', note: 'Camp is the center of it. Gatherings thin out on purpose.', start: { kind: 'date', month: 6, day: 1 }, on: true }
];

export const BLOCK_DEFAULTS: BlockDef[] = [
  { id: 'setup', name: 'Setup', note: 'Room, chairs, snack table', mins: 25, seg: 'pre', on: true },
  { id: 'huddle', name: 'Leader huddle', note: 'Prayer and the plan for the night', mins: 15, seg: 'pre', on: true },
  { id: 'doors', name: 'Doors', note: 'Hangout, check-in', mins: 15, seg: 'main', on: true },
  { id: 'game', name: 'Game', note: 'Large group', mins: 15, seg: 'main', on: true },
  { id: 'worship', name: 'Worship', note: 'Band, two or three songs', mins: 20, seg: 'main', on: true },
  { id: 'teaching', name: 'Teaching', note: 'The series message', mins: 25, seg: 'main', on: true },
  { id: 'ministry', name: 'Ministry time', note: 'Live activities on phones', mins: 10, seg: 'main', on: false },
  { id: 'groups', name: 'Small groups', note: 'By grade and gender', mins: 30, seg: 'main', on: true },
  { id: 'sendoff', name: 'Send-off', note: 'Announcements and pickup', mins: 10, seg: 'main', on: true },
  { id: 'teardown', name: 'Tear down', note: 'Chairs stacked, sound off', mins: 20, seg: 'post', on: true },
  { id: 'debrief', name: 'Leader debrief', note: 'Ten minutes, standing up', mins: 15, seg: 'post', on: true }
];

export const DEBRIEF_DEFAULTS = [
  { id: 'wins', q: 'What worked?', note: 'The part you would keep exactly as it was.', on: true },
  { id: 'problems', q: 'What didn’t?', note: 'What broke, ran long, or fell flat.', on: true },
  { id: 'who', q: 'Who needs a follow-up this week?', note: 'A name and why. Pastoral detail stays in Care.', on: true },
  { id: 'leaders', q: 'How were the leaders doing?', note: '', on: true }
];

export function emptyPlan(startYear: number, gatherDay = 3): Plan {
  return {
    settings: { name: 'Seven-year plan', campus: '', startYear, gatherDay, entryGrade: 6, blackouts: [], liturgical: false, translation: 'KJV' },
    lanes: LANE_DEFAULTS.map((l) => ({ ...l })),
    seasons: SEASON_DEFAULTS.map((s) => ({ ...s })),
    blocks: BLOCK_DEFAULTS.map((b) => ({ ...b })),
    debriefQs: DEBRIEF_DEFAULTS.map((q) => ({ ...q })),
    items: [],
    gatherings: {},
    published: null,
    dismissed: [],
    holyDays: {},
    changes: []
  };
}

/* ── the calendar ────────────────────────────────────────────────────── */
export const yearLabel = (startYear: number, y: number) => startYear + y + '–' + String(startYear + y + 1).slice(2);
export const yearBounds = (p: Plan, y: number) => ({ from: ymd(p.settings.startYear + y, 8, 1), to: ymd(p.settings.startYear + y + 1, 7, 31) });
export const MONTHS_FROM_AUG = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
/** 0 = August … 11 = July. */
export const monthIndex = (iso: string) => (Number(iso.slice(5, 7)) + 4) % 12;

export const inBlackout = (p: Plan, iso: string) => p.settings.blackouts.some(([a, b]) => iso >= a && iso <= b);

/** Which ministry year a date falls in (may be outside 0–6). */
export function yearOf(p: Plan, iso: string): number {
  const y = Number(iso.slice(0, 4));
  return (Number(iso.slice(5, 7)) >= 8 ? y : y - 1) - p.settings.startYear;
}

/** Every gathering night in a ministry year, blackouts removed. */
export function nightsOf(p: Plan, y: number): string[] {
  const { from, to } = yearBounds(p, y);
  let d = addDays(from, (p.settings.gatherDay - weekdayOf(from) + 7) % 7);
  const out: string[] = [];
  while (d <= to) {
    if (!inBlackout(p, d)) out.push(d);
    d = addDays(d, 7);
  }
  return out;
}

function anchorDate(a: SeasonAnchor, y: number, startYear: number): string {
  const fallYear = startYear + y;
  if (a.kind === 'advent') return advent1(fallYear);
  if (a.kind === 'ash') return addDays(easter(fallYear + 1), -46);
  if (a.kind === 'easter') return addDays(easter(fallYear + 1), a.offset);
  return ymd(a.month >= 8 ? fallYear : fallYear + 1, a.month, a.day);
}

export interface ResolvedSeason extends PlanSeason {
  from: string;
  to: string;
  nights: string[];
}

/** The year's seasons with their dates resolved: each starts on its first
 *  night on or after its anchor and runs until the next one starts. */
export function seasonsOf(p: Plan, y: number): ResolvedSeason[] {
  const nights = nightsOf(p, y);
  const { from, to } = yearBounds(p, y);
  const starts = p.seasons
    .filter((s) => s.on)
    .map((s) => ({ s, at: anchorDate(s.start, y, p.settings.startYear) }))
    .map(({ s, at }) => ({ s, at: at < from ? from : at }))
    .sort((a, b) => a.at.localeCompare(b.at));
  return starts.map(({ s, at }, i) => {
    const end = i + 1 < starts.length ? addDays(starts[i + 1].at, -1) : to;
    return { ...s, from: at, to: end, nights: nights.filter((n) => n >= at && n <= end) };
  });
}

export const seasonOfNight = (p: Plan, iso: string) => seasonsOf(p, yearOf(p, iso)).find((s) => iso >= s.from && iso <= s.to) ?? null;

/** A year's teaching series in order: by start month, then as entered. */
export function teachingOf(p: Plan, y: number): PlanItem[] {
  return p.items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => it.year === y && it.kind === 'series' && it.lane === 'teach')
    .sort((a, b) => (a.it.month ?? 99) - (b.it.month ?? 99) || a.i - b.i)
    .map(({ it }) => it);
}

/** Series laid back to back across the year's nights: night → (series, week). */
export function teachingByNight(p: Plan, y: number): Record<string, { series: PlanItem; week: number; of: number }> {
  const nights = nightsOf(p, y);
  const out: Record<string, { series: PlanItem; week: number; of: number }> = {};
  let i = 0;
  for (const s of teachingOf(p, y)) {
    if (s.month !== undefined) while (i < nights.length && monthIndex(nights[i]) < s.month) i++;
    for (let w = 1; w <= s.size && i < nights.length; w++, i++) out[nights[i]] = { series: s, week: w, of: s.size };
  }
  return out;
}

/** The night's service order — its own, or the template from the blocks. */
export function orderOf(p: Plan, iso: string): OrderBlock[] {
  const own = p.gatherings[iso]?.order;
  if (own) return own;
  return p.blocks.filter((b) => b.on).map((b) => ({ id: b.id, seg: b.seg, kind: b.name, title: '', mins: b.mins, lead: null }));
}

/** Planned against actual, per block and net. */
export function timings(p: Plan, iso: string) {
  const order = orderOf(p, iso);
  const actual = p.gatherings[iso]?.debrief?.actual ?? {};
  const rows = order
    .filter((b) => b.seg === 'main')
    .map((b) => ({ id: b.id, label: b.title || b.kind, planned: b.mins, actual: actual[b.id] ?? null, off: actual[b.id] != null ? actual[b.id] - b.mins : 0 }));
  return { rows, net: rows.reduce((n, r) => n + r.off, 0), recorded: rows.some((r) => r.actual != null) };
}

/** The next night after `iso` still ahead of `today` — where timings carry. */
export function nextNight(p: Plan, iso: string, today: string): string | null {
  const y = yearOf(p, iso);
  return [...nightsOf(p, y), ...nightsOf(p, y + 1)].find((n) => n > iso && n >= today) ?? null;
}

/** A gathering's plan with the night's real times: block start clock from setup. */
export function orderTimes(order: OrderBlock[], setupAt: string) {
  const [h, m] = setupAt.split(':').map(Number);
  let at = h * 60 + m;
  return order.map((b) => {
    const start = at;
    at += b.mins;
    return { ...b, start };
  });
}

export const clockOf = (mins: number) => {
  const h = Math.floor(mins / 60) % 24;
  return ((h + 11) % 12) + 1 + ':' + String(mins % 60).padStart(2, '0') + (h >= 12 ? 'pm' : 'am');
};
