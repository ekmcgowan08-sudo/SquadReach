/* Scoring maths. Pure functions over the ledger — nothing here holds state,
   so every number on every screen can be unit-tested and recomputed. */
import type { Category, EntryDetail, LedgerEntry, MinistryConfig, Student, Team } from '@/lib/types/model';

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
export const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));

/** The point base grows through the season, so week 9 is worth more than week 1. */
export function pointBase(c: Pick<MinistryConfig, 'pointBase' | 'weekGrowthPct' | 'weekNumber'>): number {
  return Math.round(c.pointBase * (1 + (Math.max(1, c.weekNumber) - 1) * (c.weekGrowthPct / 100)));
}

/** Only approved entries count. A pending row is a request, not a score. */
export const counts = (e: LedgerEntry) => e.status === 'approved';

/** Sum of the category totals, so the total always equals its segments. */
export function teamTotal(ledger: LedgerEntry[], teamId: string): number {
  return Object.values(categoryTotals(ledger, teamId)).reduce((n, v) => n + v, 0);
}

export function categoryTotals(ledger: LedgerEntry[], teamId: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of ledger) {
    if (e.team !== teamId || !counts(e)) continue;
    out[e.cat] = (out[e.cat] || 0) + e.amount;
  }
  for (const k of Object.keys(out)) out[k] = Math.max(0, out[k]);
  return out;
}

export interface StandingSeg {
  id: string;
  label: string;
  color: string;
  value: number;
  pct: number;
}

export interface Standing {
  id: string;
  name: string;
  color: string;
  rank: number;
  total: number;
  barPct: number;
  /** Points behind the leader; 0 for the leader. */
  behind: number;
  segs: StandingSeg[];
}

export function standings(teams: Team[], cats: Category[], ledger: LedgerEntry[]): Standing[] {
  const ranked = teams
    .map((t) => ({ t, total: teamTotal(ledger, t.id), cat: categoryTotals(ledger, t.id) }))
    .sort((a, b) => b.total - a.total || a.t.sort - b.t.sort);
  const max = Math.max(1, ...ranked.map((r) => r.total));
  const lead = ranked[0]?.total ?? 0;
  return ranked.map((r, i) => ({
    id: r.t.id,
    name: r.t.name,
    color: r.t.color,
    rank: i + 1,
    total: r.total,
    barPct: Math.round((r.total / max) * 100),
    behind: lead - r.total,
    segs: cats.map((c) => ({
      id: c.id,
      label: c.label,
      color: c.color,
      value: r.cat[c.id] || 0,
      pct: Math.round(((r.cat[c.id] || 0) / (r.total || 1)) * 100)
    }))
  }));
}

const ordinal = (n: number) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n + 'th');

/** "1st to 4th 8,065" — the three gap tiles over the standings. */
export function standingGaps(rows: Standing[]): { label: string; value: string }[] {
  const last = rows.length - 1;
  const pairs: [number, number][] = [];
  if (last >= 1) pairs.push([0, last]);
  if (last >= 2) pairs.push([0, last - 1]);
  if (last >= 3) pairs.push([1, last]);
  return pairs.map(([a, b]) => ({ label: ordinal(a + 1) + ' to ' + ordinal(b + 1), value: fmt(rows[a].total - rows[b].total) }));
}

export const deltaLabel = (r: Pick<Standing, 'rank' | 'behind'>) => (r.rank === 1 ? 'leading' : '−' + fmt(r.behind) + ' back');

/** A student's season points: what they carried in, plus every approved
 *  ledger row that names them. */
export function studentTotal(name: string, ledger: LedgerEntry[], seed: Record<string, number>): number {
  let n = seed[name] || 0;
  for (const e of ledger) if (e.student === name && counts(e)) n += e.amount;
  return Math.max(0, n);
}

export function studentRanks(roster: Student[], ledger: LedgerEntry[], seed: Record<string, number>) {
  return roster
    .map((r) => ({ name: r.name, team: r.team, total: studentTotal(r.name, ledger, seed) }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/* ── The per-student check-in sheet ──────────────────────────────────────
   STUDENT_ITEMS rows can carry an `expand` type. A row with one opens a
   panel in the same tap that turns it on — a count that stays hidden is a
   count nobody sets. studentItemValue() is the ONLY place a row's value is
   computed; keep it that way. */
export type ExpandKind = 'friends' | 'articles' | 'verses' | 'proof' | 'where';

export interface StudentItem {
  id: string;
  label: string;
  cat: string;
  pts?: number;
  mult?: number;
  expand?: ExpandKind;
  verseSet?: 'sunday' | 'week';
  friendKind?: 'known' | 'new';
}

export const STUDENT_ITEMS: StudentItem[] = [
  { id: 'attend', label: 'Attended Sunday morning worship', cat: 'general', pts: 50, expand: 'where' },
  { id: 'church_vol', label: 'Volunteered at church', cat: 'general', pts: 50, expand: 'proof' },
  { id: 'community_vol', label: 'Volunteered in community', cat: 'general', pts: 50, expand: 'proof' },
  { id: 'good_sport', label: 'Sportsmanship call-out', cat: 'general', pts: 100 },
  { id: 'sl_shirt', label: 'Ministry shirt', cat: 'spiritwear', pts: 30 },
  { id: 'team_color', label: 'Dressed in team color', cat: 'spiritwear', pts: 30, expand: 'articles' },
  { id: 'theme', label: 'Dressed for the theme', cat: 'spiritwear', pts: 10 },
  { id: 'bible', label: 'Brought a Bible', cat: 'bible', pts: 50 },
  { id: 'sunday_verse', label: 'Sunday verse', cat: 'verses', pts: 20, expand: 'verses', verseSet: 'sunday' },
  { id: 'week_verse', label: 'Week verse', cat: 'verses', pts: 20, expand: 'verses', verseSet: 'week' },
  { id: 'friend_in_db', label: 'Brought a friend (already in DB)', cat: 'visitors', mult: 1, expand: 'friends', friendKind: 'known' },
  /* One row with a count, not one row per friend — a "second new friend"
     row could not describe a student who brought four. */
  { id: 'friend_new_1', label: 'Brought a new friend', cat: 'visitors', mult: 2, expand: 'friends', friendKind: 'new' }
];

/** Five visible pieces in the squad colour pays a bonus on top of the per-article value. */
export const ENSEMBLE_BONUS = 100;
/** Volunteering runs on trust — proof is never required, it only pays a bonus. */
export const PROOF_BONUS = 25;
/** Plain array: add a campus or a service time here, no migration. */
export const WORSHIP_PLACES = ['Main campus · 9:00', 'Main campus · 11:00', 'Another church', 'Online stream', 'Away with family', 'Somewhere else'];
/** What marking a student present pays, per category posted. */
export const CHECKIN_PRESENT_PTS = 50;

export interface SheetState {
  picks: Record<string, boolean>;
  counts: Record<string, number>;
  articles: number;
  verses: Record<string, number>;
  proof: Record<string, boolean>;
  where: string;
}

export const emptySheet = (): SheetState => ({ picks: {}, counts: {}, articles: 0, verses: {}, proof: {}, where: '' });

export interface ValueCtx {
  base: number;
  versePts: number;
  verseBoard: number;
}

export const verseCount = (it: StudentItem, sh: SheetState, ctx: ValueCtx) =>
  Math.max(1, Math.min(Math.max(1, ctx.verseBoard), sh.verses[it.id] || 1));

export function studentItemValue(it: StudentItem, sh: SheetState, ctx: ValueCtx): number {
  if (!sh.picks[it.id]) return 0;
  if (it.expand === 'friends') return ctx.base * (it.mult || 1) * Math.max(1, sh.counts[it.id] || 1);
  if (it.expand === 'articles') {
    const n = Math.max(1, sh.articles || 1);
    return (it.pts || 0) * n + (n >= 5 ? ENSEMBLE_BONUS : 0);
  }
  /* Verse value is the pastor's, per week — not a constant. */
  if (it.expand === 'verses') return Math.max(1, ctx.versePts) * verseCount(it, sh, ctx);
  /* Trust first: the row's own value stands with no photo. */
  if (it.expand === 'proof') return (it.pts || 0) + (sh.proof[it.id] ? PROOF_BONUS : 0);
  return it.mult ? ctx.base * it.mult : it.pts || 0;
}

export function sheetDetail(it: StudentItem, sh: SheetState, ctx: ValueCtx): EntryDetail | null {
  if (it.expand === 'friends') return { count: Math.max(1, sh.counts[it.id] || 1) };
  if (it.expand === 'articles') return { articles: Math.max(1, sh.articles || 1) };
  if (it.expand === 'verses') return { verses: verseCount(it, sh, ctx) };
  if (it.expand === 'proof') return { proof: !!sh.proof[it.id] };
  if (it.expand === 'where') return { place: sh.where || '' };
  return null;
}

export const sheetFriendCount = (sh: SheetState) =>
  STUDENT_ITEMS.filter((it) => it.expand === 'friends' && sh.picks[it.id]).reduce((n, it) => n + Math.max(1, sh.counts[it.id] || 1), 0);

/** Names are required per friend: three friends means three names. */
export function parseFriendNames(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function sheetTotal(sh: SheetState, ctx: ValueCtx): number {
  return STUDENT_ITEMS.reduce((n, it) => n + studentItemValue(it, sh, ctx), 0);
}

/* ── Coach view check-in questions (the lighter per-student flow) ─────── */
export interface CheckinQuestion {
  id: string;
  label: string;
  hint: string;
  cat: string;
  pts?: number;
  mult?: number;
  icon: string;
}

export const CHECKIN_QUESTIONS: CheckinQuestion[] = [
  { id: 'bible', label: 'Brought their Bible', hint: 'Paper or app, any translation', cat: 'bible', pts: 50, icon: 'ph ph-book-bookmark' },
  { id: 'colors', label: 'Dressed in team colors', hint: 'At least one visible piece', cat: 'spiritwear', pts: 30, icon: 'ph ph-t-shirt' },
  { id: 'ensemble', label: 'Full ensemble bonus', hint: 'Five or more articles in the team color', cat: 'spiritwear', pts: 100, icon: 'ph ph-sparkle' },
  { id: 'orgwear', label: 'Wearing something from the ministry', hint: 'League shirt, hoodie, hat, lanyard', cat: 'spiritwear', pts: 30, icon: 'ph ph-shield-check' },
  { id: 'verse', label: 'Recited the memory verse', hint: 'This week’s verse, from memory', cat: 'verses', pts: 20, icon: 'ph ph-quotes' },
  { id: 'visitor', label: 'Brought a visitor', hint: 'Name them below — biggest points of the night', cat: 'visitors', mult: 2, icon: 'ph ph-user-plus' }
];

export const checkinQuestionPts = (q: CheckinQuestion, base: number) => (q.mult ? Math.round(base * q.mult) : q.pts || 0);
