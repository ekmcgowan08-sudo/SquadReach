/* ─────────────────────────────────────────────────────────────────────────
   THE AUTOMATIC FEEDS — one thing logging into another with no second entry
   by a human. All pure. These are the rules that keep a coach from entering
   the same thing twice, so they are the first thing the tests cover.

   | When this happens                       | This updates, with no extra tap |
   | Coach marks who is here + posts         | points for every present student (attendanceEntries) |
   | Recording stops on a bracket matchup    | winner advances + is paid once (settleFromClip, bracketWinPayable) |
   | Standings change                        | bracket seeds re-order until the first result (bracketSeeds) |
   | A small-group answer is approved        | squad points + challenge credit (creditChallenges) |
   | Church info is edited                   | the Home church card re-renders (churchRows / churchSocials) |
   | A volunteer is marked not coming        | their post shows as uncovered (uncoveredPosts) |
   ───────────────────────────────────────────────────────────────────────── */
import type {
  Category, Challenge, ChurchInfo, CrewState, HuddleState, LedgerEntry, Student, Team
} from '@/lib/types/model';
import { CHECKIN_PRESENT_PTS, teamTotal } from '@/lib/scoring';

/* ── standings → bracket seeding ─────────────────────────────────────────
   Seeds follow the live standings until the first result is entered, or
   until someone drags a seed by hand (liveSeed goes false). */
export interface BracketState {
  enabled: boolean;
  seeds: string[];
  winners: Record<string, string>;
  liveSeed: boolean;
  /** match key -> team already paid for that win, so a correction never double-pays */
  paid: Record<string, string>;
}

export interface BracketMatch {
  key: string;
  round: number;
  a: string | null;
  b: string | null;
  winner: string | null;
}

export function bracketSeeds(teams: Team[], ledger: LedgerEntry[], b: BracketState): string[] {
  const live = b.liveSeed && Object.keys(b.winners).length === 0;
  if (live) {
    return teams
      .slice()
      .sort((x, y) => teamTotal(ledger, y.id) - teamTotal(ledger, x.id) || x.sort - y.sort)
      .map((t) => t.id);
  }
  return b.seeds.length === teams.length ? b.seeds : teams.map((t) => t.id);
}

export function buildBracket(seedIds: string[], winners: Record<string, string>): BracketMatch[][] {
  let current: (string | null)[] = seedIds.slice();
  let size = 1;
  while (size < current.length) size *= 2;
  while (current.length < size) current.push(null);
  const rounds: BracketMatch[][] = [];
  let round = 0;
  while (current.length > 1) {
    const matches: BracketMatch[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const key = round + '-' + i / 2;
      matches.push({ key, round, a: current[i] ?? null, b: current[i + 1] ?? null, winner: winners[key] ?? null });
    }
    rounds.push(matches);
    /* A bye advances on its own. */
    current = matches.map((m) => m.winner ?? (m.a && !m.b ? m.a : m.b && !m.a ? m.b : null));
    round++;
  }
  return rounds;
}

/** The next game that still needs playing — what the recorder offers as one tap. */
export function nextBracketGame(teams: Team[], ledger: LedgerEntry[], b: BracketState): { match: BracketMatch; label: string } | null {
  if (!b.enabled) return null;
  const rounds = buildBracket(bracketSeeds(teams, ledger, b), b.winners);
  for (let i = 0; i < rounds.length; i++) {
    const m = rounds[i].find((x) => x.a && x.b && !x.winner);
    if (m) {
      const left = rounds.length - i;
      return { match: m, label: left === 1 ? 'Final' : left === 2 ? 'Semifinal' : 'Round ' + (i + 1) };
    }
  }
  return null;
}

/** Stop recording and the squad with more game points advances. Null when the
 *  clip was not the bracket game being played, or it ended level. */
export function settleFromClip(
  teams: Team[], ledger: LedgerEntry[], b: BracketState, playing: string[], gamePts: Record<string, number>
): { matchKey: string; winner: string } | null {
  const next = nextBracketGame(teams, ledger, b);
  if (!next) return null;
  const { a, b: bb, key } = next.match;
  if (playing.length !== 2 || !a || !bb || !playing.includes(a) || !playing.includes(bb)) return null;
  const pa = gamePts[a] ?? 0;
  const pb = gamePts[bb] ?? 0;
  if (pa === pb) return null;
  return { matchKey: key, winner: pa > pb ? a : bb };
}

/** A bracket win pays once. `paid` guards a corrected result from paying twice. */
export const bracketWinPayable = (b: BracketState, matchKey: string, winner: string) => b.paid[matchKey] !== winner;

/* ── attendance → tonight's points ───────────────────────────────────────
   Marking who is here IS the scoring step. There is no separate submit.
   One row per present student per category posted — 28 students posting
   General + Visitors is 56 rows, which is why the outbox groups by
   squad × category when it shows what is held. */
export function attendanceRows(
  roster: Student[], teamId: string, presence: Record<string, boolean>, cats: Category[], autoCats: Record<string, boolean>
): { student: string; cat: string; amount: number }[] {
  const here = roster.filter((r) => r.team === teamId && presence[r.name]);
  const paying = cats.filter((c) => c.id === 'general' || autoCats[c.id]);
  const out: { student: string; cat: string; amount: number }[] = [];
  for (const r of here) for (const c of paying) out.push({ student: r.name, cat: c.id, amount: CHECKIN_PRESENT_PTS });
  return out;
}

/* ── small-group answers → challenge credit ──────────────────────────────
   An approved answer credits the student on every active challenge their
   squad is eligible for. Idempotent per student. */
export function creditChallenges(
  challenges: Challenge[], credit: Record<string, string[]>, student: string, teamId: string
): Record<string, string[]> | null {
  const next = { ...credit };
  let touched = 0;
  for (const c of challenges) {
    if (c.team && c.team !== teamId) continue;
    const list = next[c.id] ? next[c.id].slice() : [];
    if (list.includes(student)) continue;
    list.push(student);
    next[c.id] = list;
    touched++;
  }
  return touched ? next : null;
}

/** The challenges running in a week: scheduled for it, or for every week. */
export const challengesIn = (challenges: Challenge[], week: number) => challenges.filter((c) => !c.weeks || c.weeks.includes(week));

/* ── Setup fields → the Home church card ─────────────────────────────────
   Blank fields disappear; nothing renders an empty row. */
export interface ContactRow {
  icon: string;
  label: string;
  value: string;
  href: string;
}

const ext = (v: string) => {
  const t = (v || '').trim();
  if (!t) return '';
  return /^https?:/i.test(t) ? t : 'https://' + t.replace(/^@/, '');
};
const handle = (v: string, base: string) => (v.trim().startsWith('@') ? base + v.trim().slice(1) : ext(v));

export function churchRows(c: ChurchInfo): ContactRow[] {
  const out: ContactRow[] = [];
  if (c.address.trim()) out.push({ icon: 'ph ph-map-pin', label: 'Visit', value: c.address, href: 'https://maps.google.com/?q=' + encodeURIComponent(c.address) });
  if (c.phone.trim()) out.push({ icon: 'ph ph-phone', label: 'Call', value: c.phone, href: 'tel:' + c.phone.replace(/[^0-9+]/g, '') });
  if (c.email.trim()) out.push({ icon: 'ph ph-envelope-simple', label: 'Email', value: c.email, href: 'mailto:' + c.email.trim() });
  if (c.web.trim()) out.push({ icon: 'ph ph-globe', label: 'Church website', value: c.web, href: ext(c.web) });
  if (c.studentsPage.trim()) out.push({ icon: 'ph ph-users-three', label: 'Student ministry', value: c.studentsPage, href: ext(c.studentsPage) });
  return out;
}

export function churchSocials(c: ChurchInfo): { icon: string; label: string; href: string }[] {
  const out: { icon: string; label: string; href: string }[] = [];
  if (c.instagram.trim()) out.push({ icon: 'ph ph-instagram-logo', label: 'Instagram', href: handle(c.instagram, 'https://instagram.com/') });
  if (c.youtube.trim()) out.push({ icon: 'ph ph-youtube-logo', label: 'YouTube', href: handle(c.youtube, 'https://youtube.com/@') });
  if (c.facebook.trim()) out.push({ icon: 'ph ph-facebook-logo', label: 'Facebook', href: handle(c.facebook, 'https://facebook.com/') });
  if (c.tiktok.trim()) out.push({ icon: 'ph ph-tiktok-logo', label: 'TikTok', href: handle(c.tiktok, 'https://tiktok.com/@') });
  return out;
}

/* ── the huddle: uncovered posts are computed, never a second list ───────
   A post is a place plus a group. The posts of everyone marked NOT COMING,
   plus the posts that were never filled, minus anything already covered.
   So marking someone out opens their post by itself — there is no second
   screen to keep in step. */
export interface UncoveredPost {
  id: string;
  post: string;
  why: string;
  crewId: string | null;
}

export function uncoveredPosts(h: Pick<HuddleState, 'crew' | 'crewState' | 'openPosts' | 'covered'>): UncoveredPost[] {
  const out: UncoveredPost[] = [];
  for (const c of h.crew) {
    if (h.crewState[c.id] !== 'out') continue;
    const id = 'crew:' + c.id;
    if (h.covered[id]) continue;
    out.push({ id, post: c.post, why: c.name.split(' ')[0] + ' is not coming', crewId: c.id });
  }
  for (const p of h.openPosts) {
    if (h.covered[p.id]) continue;
    out.push({ id: p.id, post: p.post, why: p.why, crewId: null });
  }
  return out;
}

/** The bench, minus anyone already covering a post: one body, one post. */
export function availableBench(h: Pick<HuddleState, 'bench' | 'covered'>) {
  const busy = new Set(Object.values(h.covered));
  return h.bench.filter((b) => !busy.has(b.id));
}

export function crewCounts(crewState: Record<string, CrewState | undefined>, crewIds: string[]) {
  let here = 0, late = 0, out = 0, unmarked = 0;
  for (const id of crewIds) {
    const st = crewState[id];
    if (st === 'here') here++;
    else if (st === 'late') late++;
    else if (st === 'out') out++;
    else unmarked++;
  }
  return { here, late, out, unmarked, total: crewIds.length };
}
