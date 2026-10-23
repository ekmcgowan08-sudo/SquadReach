/* Derived values the screens share. Pure functions of the store's state, so
   two screens can never disagree about the same number. */
import { uncoveredPosts } from '@/lib/feeds';
import { fmt, pointBase } from '@/lib/scoring';
import { canApprove, canHuddle } from '@/lib/permissions';
import { personaDef, type Persona } from '@/lib/types/domain';
import type { AudienceId, Membership, MinistryData, MinistryEvent, RunSheetItem } from '@/lib/types/model';

export const teamOf = (d: MinistryData, id: string | null | undefined) =>
  d.teams.find((t) => t.id === id) ?? { id: id ?? '', name: 'Removed team', color: 'var(--color-neutral-600)', mascotName: '', mascotStory: '', sort: 99 };

export const catOf = (d: MinistryData, id: string) =>
  d.cats.find((c) => c.id === id) ?? { id, label: 'Removed category', color: 'var(--color-neutral-600)', icon: 'ph ph-tag', hint: '' };

export function teamRoster(d: MinistryData, teamId: string) {
  return d.roster.filter((r) => r.team === teamId);
}

export function teamMetaLabel(d: MinistryData, teamId: string) {
  const roster = teamRoster(d, teamId);
  if (!roster.length) return 'roster not imported yet';
  const caps = roster.filter((r) => r.captain).length;
  return roster.length + (roster.length === 1 ? ' student · ' : ' students · ') + caps + (caps === 1 ? ' captain' : ' captains');
}

/** The squad this person sees as theirs: a student's or parent's own, a
 *  coach's selection (shared with check-in), else the first squad. */
export function myTeamId(m: Membership, d: MinistryData, coachTeam: string): string {
  if (m.persona === 'member' || m.persona === 'captain' || m.persona === 'parent') {
    const kid = d.roster.find((r) => r.name === m.studentName);
    return kid?.team ?? m.teamId ?? d.teams[0]?.id ?? '';
  }
  return coachTeam || m.teamId || d.teams[0]?.id || '';
}

/* ── badges: attendance AND Bible streak running together ─────────────── */
export interface Badge {
  name: string;
  teamId: string;
  attendStreak: number;
  bibleStreak: number;
  combinedWeeks: number;
  tier: 'Gold' | 'Silver' | 'Bronze' | null;
}

export function computeBadges(d: MinistryData): Badge[] {
  return d.studentBadges
    .map((b) => {
      const bibleWeeks = Math.ceil(b.bibleStreak / 7);
      const combinedWeeks = Math.min(b.attendStreak, bibleWeeks);
      const tier: Badge['tier'] = combinedWeeks >= 6 ? 'Gold' : combinedWeeks >= 3 ? 'Silver' : combinedWeeks >= 1 ? 'Bronze' : null;
      return { name: b.name, teamId: b.team, attendStreak: b.attendStreak, bibleStreak: b.bibleStreak, combinedWeeks, tier };
    })
    .sort((a, b) => b.combinedWeeks - a.combinedWeeks);
}

/** Medal colours are data, not theme — but they still have to be readable
 *  (bronze was raised to 5.18:1 in the design audit). */
export const TIER_COLOR: Record<string, string> = { Gold: '#E0B04A', Silver: '#C9CCD6', Bronze: '#CE8555' };

/* ── who sees which event ─────────────────────────────────────────────── */
export function audienceOf(p: Persona): AudienceId | null {
  const map: Record<Persona, AudienceId | null> = {
    leader: 'leaders', owner: 'admins', scorekeeper: 'scorekeeper', coach: 'coaches',
    captain: 'captains', member: 'members', parent: 'parents', congregation: null
  };
  return map[p];
}

export const ALL_AUDIENCES: AudienceId[] = ['members', 'captains', 'coaches', 'scorekeeper', 'leaders', 'parents', 'admins'];

export function eventVisible(e: MinistryEvent, p: Persona) {
  const a = audienceOf(p);
  if (!a) return e.roles.length === ALL_AUDIENCES.length;
  return e.roles.includes(a);
}

/* ── notifications ────────────────────────────────────────────────────── */
export interface Notice {
  icon: string;
  label: string;
  meta: string;
  href: string;
}

export function computeNotifications(d: MinistryData, m: Membership): Notice[] {
  const list: Notice[] = [];
  const p = m.persona;
  if (canApprove(p)) {
    for (const r of d.accessRequests.filter((x) => x.status === 'pending')) {
      list.push({
        icon: 'ph ph-user-focus',
        label: r.name + ' requested ' + personaDef(r.requestedRole).label + ' access',
        meta: r.flagged ? 'Parent link unconfirmed — verify first' : r.personType + ' · ' + r.household,
        href: '/dashboard/access-requests'
      });
    }
    const pending = d.ledger.filter((e) => e.status === 'pending').length;
    if (pending) list.push({ icon: 'ph ph-seal-check', label: pending + (pending === 1 ? ' point request' : ' point requests') + ' waiting on you', meta: 'Approve or send back from Home', href: '/dashboard/approvals' });
    if (d.prayerQueue.length) list.push({ icon: 'ph ph-hands-praying', label: d.prayerQueue.length + (d.prayerQueue.length === 1 ? ' prayer request' : ' prayer requests') + ' to review', meta: 'Nothing is public until you post it', href: '/dashboard/follow-ups' });
  }
  const next = d.events.find((e) => eventVisible(e, p));
  if (next) list.push({ icon: 'ph ph-calendar-dots', label: 'Upcoming: ' + next.title, meta: next.date + ' · ' + next.meta, href: '/dashboard/events/' + next.id });
  list.push({ icon: 'ph ph-chart-line-up', label: 'Week ' + d.config.weekNumber + ' summary ready', meta: fmt(pointBase(d.config)) + ' pt base · standings updated', href: '/dashboard' });
  if (canHuddle(p)) {
    for (const it of d.huddle.runSheet.filter((x) => x.assignedTo && x.notifiedAt).slice(0, 4)) {
      const who = d.huddle.crew.find((c) => c.id === it.assignedTo);
      if (who) list.push({ icon: 'ph ph-clipboard-text', label: who.name + ' owns ' + it.time + ' · ' + it.label, meta: 'Run sheet published', href: '/dashboard/huddle' });
    }
  }
  if (d.bible.streak > 0) list.push({ icon: 'ph ph-fire', label: 'Your ' + d.bible.streak + '-day streak is on the line', meta: 'Practice today to keep it alive', href: '/dashboard/bible' });
  if (!d.bible.loggedToday) list.push({ icon: 'ph ph-book-open-text', label: 'Bible practice reminder', meta: d.bible.due + ' verses due for review', href: '/dashboard/bible' });
  return list;
}

/* ── the run sheet as a clock ─────────────────────────────────────────── */
/** "6:15pm" → minutes since midnight. */
export function sheetMinutes(t: string): number | null {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*$/i.exec(t || '');
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if ((m[3] || 'pm').toLowerCase() === 'pm') h += 12;
  return h * 60 + Number(m[2] || 0);
}

export function clockLabel(mins: number) {
  const h = Math.floor(mins / 60) % 24;
  const mm = Math.round(mins % 60);
  return ((h + 11) % 12) + 1 + ':' + String(mm).padStart(2, '0') + (h >= 12 ? ' pm' : ' am');
}

/** Planned length of item i: until the next item starts (the last runs 10). */
export function runMinutes(sheet: RunSheetItem[], i: number): number {
  const a = sheetMinutes(sheet[i]?.time ?? '');
  const b = sheetMinutes(sheet[i + 1]?.time ?? '');
  if (a == null) return 10;
  if (b == null || b <= a) return 10;
  return b - a;
}

export interface NightPhase {
  before: boolean;
  during: boolean;
  after: boolean;
  line: string;
  dot: string;
  pct: number;
  start: number;
  end: number;
  blocks: { label: string; mins: number; at: string; past: boolean; cur: boolean; who: string }[];
}

/** Where tonight is against the plan, for the Home Tonight card. Measured by
 *  the wall clock only for the "starts in" line — the huddle itself never
 *  advances on its own (decided in review). */
export function nightPhase(sheet: RunSheetItem[], runIdx: number, now = new Date()): NightPhase | null {
  if (!sheet.length) return null;
  const start = sheetMinutes(sheet[0].time) ?? 18 * 60;
  const total = sheet.reduce((n, _, i) => n + runMinutes(sheet, i), 0);
  const end = start + total;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const before = nowMin < start && runIdx === 0;
  const after = nowMin >= end;
  const during = !before && !after;
  const dur = (m: number) => (m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + ' min');
  let acc = 0;
  const blocks = sheet.map((it, i) => {
    const mins = runMinutes(sheet, i);
    const at = clockLabel(start + acc);
    acc += mins;
    return { label: it.label, mins, at, past: i < runIdx, cur: during && i === runIdx, who: it.who };
  });
  const cur = sheet[Math.min(runIdx, sheet.length - 1)];
  return {
    before,
    during,
    after,
    start,
    end,
    line: before ? 'Huddle starts in ' + dur(start - nowMin) : after ? 'Wrapped at ' + clockLabel(end) + ' · debrief while it is fresh' : 'Live now · ' + cur.label,
    dot: before ? 'var(--color-neutral-500)' : after ? 'var(--color-neutral-600)' : 'var(--color-accent)',
    pct: Math.max(0, Math.min(100, ((nowMin - start) / Math.max(1, total)) * 100)),
    blocks
  };
}

/** Things waiting on a leader, as one list — fed by the same data the
 *  screens they link to read. */
export function leaderNeeds(d: MinistryData) {
  const out: { id: string; icon: string; title: string; meta: string; href: string }[] = [];
  const pending = d.ledger.filter((e) => e.status === 'pending');
  if (pending.length)
    out.push({ id: 'approvals', icon: 'ph-seal-check', title: pending.length + (pending.length === 1 ? ' point request to approve' : ' point requests to approve'), meta: [...new Set(pending.map((p) => p.by))].slice(0, 3).join(', '), href: '/dashboard/approvals' });
  for (const u of uncoveredPosts(d.huddle)) out.push({ id: 'post:' + u.id, icon: 'ph-user-plus', title: u.post + ' has nobody on it', meta: u.why + ' · the bench is one tap away', href: '/dashboard/huddle' });
  if (d.prayerQueue.length)
    out.push({ id: 'prayer', icon: 'ph-hands-praying', title: d.prayerQueue.length + (d.prayerQueue.length === 1 ? ' prayer request to review' : ' prayer requests to review'), meta: 'Nothing is public until you post it', href: '/dashboard/follow-ups' });
  const access = d.accessRequests.filter((r) => r.status === 'pending');
  if (access.length) out.push({ id: 'access', icon: 'ph-user-focus', title: access.length + (access.length === 1 ? ' person waiting on access' : ' people waiting on access'), meta: access.map((a) => a.name).join(', '), href: '/dashboard/access-requests' });
  const deep = d.deepSubs.filter((s) => s.status === 'pending');
  if (deep.length) out.push({ id: 'deep', icon: 'ph-book-open-text', title: deep.length + (deep.length === 1 ? ' small-group response to review' : ' small-group responses to review'), meta: 'Approving pays the squad and credits the challenges', href: '/dashboard/races' });
  if (!d.huddle.nightClosed && d.huddle.debriefNotes.length === 0 && d.config.weekNumber > 1)
    out.push({ id: 'debrief', icon: 'ph-notepad', title: 'Tonight is not debriefed yet', meta: 'Three things at 8:50 — held entries, who to follow up on, one change', href: '/dashboard/huddle' });
  return out;
}
