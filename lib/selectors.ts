/* Derived values the screens share. Pure functions of the store's state, so
   two screens can never disagree about the same number. */
import { corrections } from '@/lib/corrections';
import { uncoveredPosts } from '@/lib/feeds';
import { fmt, pointBase } from '@/lib/scoring';
import { canApprove, canCoordinateServing, canHuddle, canMessageParents, canNightRecap, canPrepWeek, holdsSheet } from '@/lib/permissions';
import { cycleNeeds, reminders, selfName, type CycleNeed } from '@/lib/cycle';
import { personaDef, type Persona } from '@/lib/types/domain';
import { bibleStats } from '@/lib/bible';
import { isoDay } from '@/lib/dates';
import type { AudienceId, Delivery, Membership, MinistryData, MinistryEvent, RsvpCount, RunSheetItem } from '@/lib/types/model';
import { deliveriesDueToday, deliveryRecipientGroups, deliverySent, deliverySentence, reportSpec } from '@/lib/report-builder';

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
  if (e.status === 'proposed') return false;
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
  /** Which setting turns this kind off (lib/prefs NOTIF_TRIGGERS). */
  trigger: string;
}

export function computeNotifications(d: MinistryData, m: Membership, on: Record<string, boolean> = {}): Notice[] {
  const list: Notice[] = [];
  const p = m.persona;
  if (canApprove(p)) {
    for (const r of d.accessRequests.filter((x) => x.status === 'pending')) {
      list.push({
        icon: 'ph ph-user-focus',
        label: r.name + ' requested ' + personaDef(r.requestedRole).label + ' access',
        meta: r.flagged ? 'Parent link unconfirmed — verify first' : r.personType + ' · ' + r.household,
        href: '/dashboard/access-requests',
        trigger: 'roleRequest'
      });
    }
    const pending = d.ledger.filter((e) => e.status === 'pending').length;
    if (pending) list.push({ icon: 'ph ph-seal-check', label: pending + (pending === 1 ? ' point request' : ' point requests') + ' waiting on you', meta: 'Approve or send back from Home', href: '/dashboard/approvals', trigger: 'approvals' });
    for (const e of d.events.filter((x) => x.status === 'proposed')) {
      list.push({ icon: 'ph ph-calendar-plus', label: 'New event proposal: ' + e.title, meta: e.by ?? e.date, href: '/dashboard/calendar', trigger: 'event' });
    }
    if (d.prayerQueue.length) list.push({ icon: 'ph ph-hands-praying', label: d.prayerQueue.length + (d.prayerQueue.length === 1 ? ' prayer request' : ' prayer requests') + ' to review', meta: 'Nothing is public until you post it', href: '/dashboard/follow-ups', trigger: 'prayer' });
    for (const c of corrections(d))
      list.push({ icon: 'ph ph-arrow-counter-clockwise', label: 'Correction: ' + c.line, meta: 'Sent after the night’s report went out', href: '/dashboard/audit', trigger: 'weeklySummary' });
    for (const f of openChatFlags(d))
      list.push({ icon: 'ph ph-flag', label: f.by + ' flagged the ' + f.threadName + ' thread', meta: 'Read it, then mark it read', href: '/dashboard/chat?t=' + encodeURIComponent(f.thread), trigger: 'chatFlag' });
  }
  /* Asked from the huddle to cover a post that's still open. */
  {
    const meName = servingName(d, m);
    for (const u of uncoveredPosts(d.huddle))
      for (const id of d.huddle.subAsks[u.id] ?? []) {
        if (d.huddle.bench.find((b) => b.id === id)?.name !== meName) continue;
        list.push({ icon: 'ph ph-hand-waving', label: 'Can you cover ' + u.post + ' tonight?', meta: u.why + ' — tell the leader yes or no', href: '/dashboard/huddle', trigger: 'runSheet' });
      }
  }
  const next = d.events.find((e) => eventVisible(e, p));
  if (next) list.push({ icon: 'ph ph-calendar-dots', label: 'Upcoming: ' + next.title, meta: next.date + ' · ' + next.meta, href: '/dashboard/events/' + next.id, trigger: 'event' });
  list.push({ icon: 'ph ph-chart-line-up', label: 'Week ' + d.config.weekNumber + ' summary ready', meta: fmt(pointBase(d.config)) + ' pt base · standings updated', href: '/dashboard', trigger: 'weeklySummary' });
  if (canHuddle(p)) {
    for (const it of d.huddle.runSheet.filter((x) => x.assignedTo && x.notifiedAt).slice(0, 4)) {
      const who = d.huddle.crew.find((c) => c.id === it.assignedTo);
      if (who) list.push({ icon: 'ph ph-clipboard-text', label: who.name + ' owns ' + it.time + ' · ' + it.label, meta: 'Run sheet published', href: '/dashboard/huddle', trigger: 'runSheet' });
    }
  }
  /* The week around the night. */
  const iso = d.tonight.date;
  if (iso && d.config.cycle) {
    const now = Date.now();
    const me = { name: servingName(d, m), leader: canApprove(p) };
    if (canHuddle(p)) {
      const posted = reminders(d, iso, now).filter((r) => r.sent && r.aud.includes('leaders') && now - r.sentAt < 3 * 86_400_000).pop();
      if (posted) list.push({ icon: 'ph ph-bell-ringing', label: posted.label + ' · ' + posted.text, meta: 'Prep reminder', href: canPrepWeek(p) ? '/dashboard/prep-week' : '/dashboard/serving', trigger: 'nightCycle' });
      for (const s of d.serving.swaps.filter((x) => x.from === me.name && x.status !== 'pending' && now - x.at < 14 * 86_400_000).slice(0, 2))
        list.push({ icon: 'ph ph-swap', label: 'Your swap for ' + s.role.toLowerCase() + ' was ' + s.status, meta: s.status === 'approved' ? (s.to ?? 'Someone') + ' takes it' : 'You are still on', href: '/dashboard/serving', trigger: 'nightCycle' });
    }
    for (const n of myCycleNeeds(d, m, now)) list.push({ icon: 'ph ' + n.icon, label: n.title, meta: n.meta, href: n.href, trigger: 'nightCycle' });
  }
  /* Reports: what went out to me, and (for leaders) what goes out today. */
  {
    const now = Date.now();
    for (const x of myDeliveries(d, m, now)) {
      const rep = reportSpec(d, x.delivery.report);
      if (rep) list.push({ icon: 'ph ph-file-text', label: rep.label + (x.team ? ' · ' + x.label : ''), meta: 'Your scheduled report is in', href: '/dashboard/report?d=' + x.delivery.id + (x.team ? '&team=' + x.team : ''), trigger: 'reportDelivery' });
    }
    if (canApprove(p)) for (const dl of deliveriesDueToday(d, now)) list.push({ icon: 'ph ph-paper-plane-tilt', label: 'Going out today: ' + deliverySentence(d, dl), meta: 'Change or pause it in Console · Reports', href: '/console?tab=reports', trigger: 'reportDelivery' });
  }
  const bible = myBible(d, m);
  /* Staff who have never practiced aren't nagged about a streak they never started. */
  const practices = !!m.studentName || d.practiceLog.some((r) => r.who === practiceName(m));
  if (practices && bible.streak > 0 && !bible.loggedToday) list.push({ icon: 'ph ph-fire', label: 'Your ' + bible.streak + '-day streak is on the line', meta: 'Practice today to keep it alive', href: '/dashboard/bible', trigger: 'streakBreak' });
  if (practices && !bible.loggedToday) list.push({ icon: 'ph ph-book-open-text', label: 'Bible practice reminder', meta: bible.due + ' verses due for review', href: '/dashboard/bible', trigger: 'bibleReminder' });
  return list.filter((n) => on[n.trigger] !== false);
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

/** Open follow-ups only: private notes live in the same table but never close. */
export const openFollowups = (d: MinistryData) => d.careReminders.filter((r) => r.kind !== 'note' && !r.done);
export const careNotes = (d: MinistryData) => d.careReminders.filter((r) => r.kind === 'note').sort((a, b) => (b.at ?? 0) - (a.at ?? 0));

/** Whose practice rows are "mine": the student a member plays as, else the person. */
export const practiceName = (m: Membership) => m.studentName ?? m.displayName;
export const myBible = (d: MinistryData, m: Membership, now = new Date()) =>
  bibleStats(d.practiceLog.filter((r) => r.who === practiceName(m)), d.config.memoryVerses, d.config.weekNumber, now);

/* ── calendar ─────────────────────────────────────────────────────────── */
export const eventLabel = (e: MinistryEvent) =>
  e.iso ? new Date(e.iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : e.date;

/** Approved events this role may see, soonest first; past ones drop off. */
export function upcomingEvents(d: MinistryData, p: Persona, today = isoDay(new Date())): MinistryEvent[] {
  return d.events
    .filter((e) => eventVisible(e, p) && (!e.iso || e.iso >= today))
    .sort((a, b) => (a.iso ?? '9999').localeCompare(b.iso ?? '9999'));
}

/** Who may answer: anyone the event is for, while it is open. */
export const canRsvp = (e: MinistryEvent, p: Persona) => !e.rsvpClosed && eventVisible(e, p) && p !== 'congregation';
/** Names on an RSVP list are the volunteer set's (rsvp_staff_read). */
export const canSeeRsvpNames = (p: Persona) => holdsSheet(p);

export function rsvpTally(d: MinistryData, e: MinistryEvent, p: Persona): RsvpCount & { noreply: number } {
  const counts = d.rsvpCounts?.[e.id];
  let t: RsvpCount;
  if (counts && !canSeeRsvpNames(p)) t = counts;
  else {
    t = { going: 0, maybe: 0, out: 0, guests: 0 };
    for (const r of Object.values(d.rsvps[e.id] ?? {})) {
      t[r.status]++;
      if (r.status === 'going') t.guests += r.guests;
    }
  }
  /* Invited = the roster when students are in the audience, else the crew. */
  const invited = e.roles.includes('members') ? d.roster.length : Math.max(t.going + t.maybe + t.out, d.huddle.crew.length);
  return { ...t, noreply: Math.max(0, invited - t.going - t.maybe - t.out) };
}

/* ── chat ─────────────────────────────────────────────────────────────── */
/** Flags no leader has read yet — all of them, or one thread's. */
export const openChatFlags = (d: MinistryData, thread?: string) => (d.chatFlags ?? []).filter((f) => !f.seenAt && (!thread || f.thread === thread));
export const chatThreadsFor = (d: MinistryData, m: Membership, coachTeam?: string | null) =>
  d.chatThreads.filter((t) => t.read.includes(m.persona) && (!t.team || holdsSheet(m.persona) || myTeamId(m, d, coachTeam ?? '') === t.team));
export function chatStamp(at: number, now = new Date()): { day: string; time: string } {
  const d = new Date(at);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const day = isoDay(d) === isoDay(now) ? 'Today' : isoDay(d) === isoDay(y) ? 'Yesterday' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const h = d.getHours();
  const time = ((h + 11) % 12) + 1 + ':' + String(d.getMinutes()).padStart(2, '0') + (h < 12 ? 'a' : 'p');
  return { day, time };
}

/** The night cycle's "needs you" rows this person may act on: each row only
 *  when its screen is one they can open. */
export function myCycleNeeds(d: MinistryData, m: Membership, now: number): CycleNeed[] {
  const p = m.persona;
  const iso = d.tonight.date;
  if (!iso || !d.config.cycle) return [];
  const me = { name: servingName(d, m), leader: canApprove(p) };
  return cycleNeeds(d, iso, now, me).filter((n) =>
    n.id === 'cy-swaps' ? canCoordinateServing(p) : n.id.startsWith('cy-slip') ? canMessageParents(p) : canNightRecap(p)
  );
}

/** The name someone serves under. With accounts it is exactly their display
 *  name — the database checks swaps and availability against it. The demo
 *  matches "Coach Chris" to crew "Chris Alder". */
export const servingName = (d: MinistryData, m: Membership) => (m.mode === 'supabase' ? m.displayName : selfName(d, m.displayName));

/** Deliveries that have reached this person in their current period, with
 *  the copy that is theirs (their squad's, or the whole ministry's). */
export function myDeliveries(d: MinistryData, m: Membership, now: number) {
  const me = servingName(d, m);
  const mine = new Set([me, m.displayName, ...(m.studentName ? [m.studentName + ' (captain)'] : [])]);
  const out: { delivery: Delivery; team: string | null; label: string }[] = [];
  for (const dl of d.deliveries ?? []) {
    if (!deliverySent(d, dl, now)) continue;
    for (const g of deliveryRecipientGroups(d, dl)) if (g.names.some((n) => mine.has(n))) out.push({ delivery: dl, team: g.team, label: g.label });
  }
  return out;
}
