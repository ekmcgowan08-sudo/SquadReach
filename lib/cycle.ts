/* The week around a meeting night — prep reminders before it, attendance
   during it, follow-ups after it, the volunteer schedule around it and what
   families see. Every function here is pure: the screens, the family link
   and the tests all read the same answers.

   Time is real time. Demo mode can preview the week at another moment, but
   that is the caller passing a different `now`, never a second clock. */
import { isoDay, parseLocalISO, weekOf } from '@/lib/dates';
import type {
  CheckinVia, CycleConfig, Family, MinistryData, NightCycle, ParentMessage, PermissionSlip, ReminderDef, Student
} from '@/lib/types/model';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const DEFAULT_REMINDERS: ReminderDef[] = [
  { id: 'r3', label: '3 days out', days: 3, time: '09:00', beforeMin: 0, aud: ['leaders'], text: '{day} is week {week}: {game}. Check your role in the app and ask for a swap now if you can’t make it.' },
  { id: 'r1', label: 'Day before', days: 1, time: '09:00', beforeMin: 0, aud: ['leaders', 'parents'], text: 'Tomorrow at {doors}: {game}. Any permission slips are in the family link — please sign tonight.' },
  { id: 'rm', label: 'Morning of', days: 0, time: '07:30', beforeMin: 0, aud: ['parents'], text: 'Tonight {doors} to {pickup}. Pickup is at the {place}.' },
  { id: 'rh', label: 'An hour out', days: 0, time: '', beforeMin: 60, aud: ['leaders'], text: 'Setup in an hour. Huddle at {setup}.' }
];

export const DEFAULT_CYCLE: CycleConfig = {
  setupAt: '18:15',
  doorsAt: '18:45',
  endAt: '21:00',
  pickupAt: '20:45',
  pickupPlace: 'lobby doors',
  followupHours: 48,
  checkinOpensMin: 30,
  serveRoles: ['Check-in', 'Game lead', 'Worship', 'Van driver', 'Snack table'],
  reminders: DEFAULT_REMINDERS
};

export const emptyNight = (): NightCycle => ({ rem: {}, fu: {}, notes: { well: '', change: '' }, pickupShift: 0, doorFlags: [] });

/** A night's state, with defaults filled in — never undefined. */
export const nightOf = (d: MinistryData, iso: string): NightCycle => ({ ...emptyNight(), ...(d.cycle?.[iso] ?? {}) });

/* ── the clock ───────────────────────────────────────────────────────── */
/** "HH:MM" on a local date → epoch ms. */
export function atLocal(iso: string, hhmm: string): number {
  const d = parseLocalISO(iso) ?? new Date();
  const [h, m] = (hhmm || '00:00').split(':').map((x) => Number(x) || 0);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

export interface NightTimes {
  date: string;
  setup: number;
  doors: number;
  end: number;
  pickup: number;
  /** Follow-ups are due by this. */
  due: number;
  checkinOpen: number;
}

export function nightTimes(cfg: CycleConfig, iso: string, pickupShift = 0): NightTimes {
  const setup = atLocal(iso, cfg.setupAt);
  const doors = atLocal(iso, cfg.doorsAt);
  let end = atLocal(iso, cfg.endAt);
  if (end <= setup) end += DAY;
  const pickup = atLocal(iso, cfg.pickupAt) + pickupShift * MIN;
  return { date: iso, setup, doors, end, pickup, due: end + cfg.followupHours * HOUR, checkinOpen: doors - cfg.checkinOpensMin * MIN };
}

export type CyclePhase = 'prep' | 'live' | 'recap' | 'late';
export const phaseAt = (t: NightTimes, now: number): CyclePhase => (now < t.setup ? 'prep' : now < t.end ? 'live' : now < t.due ? 'recap' : 'late');
export const isAfter = (t: NightTimes, now: number) => now >= t.end;
export const checkinOpen = (t: NightTimes, now: number) => now >= t.checkinOpen && now < t.end;

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function clock(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  return ((h + 11) % 12) + 1 + ':' + String(d.getMinutes()).padStart(2, '0') + (h >= 12 ? ' pm' : ' am');
}
export const dayLabel = (ms: number) => {
  const d = new Date(ms);
  return DOW[d.getDay()] + ', ' + MON[d.getMonth()] + ' ' + d.getDate();
};
export const when = (ms: number) => dayLabel(ms) + ' · ' + clock(ms);
export const weekday = (iso: string) => DOW_LONG[(parseLocalISO(iso) ?? new Date()).getDay()];

/** "3 days 4 hr", "2 hr 10 min", "25 min" — zero parts dropped. */
export function span(ms: number): string {
  const a = Math.abs(ms);
  const d = Math.floor(a / DAY);
  const h = Math.floor((a % DAY) / HOUR);
  const m = Math.round((a % HOUR) / MIN);
  if (d > 0) return d + (d === 1 ? ' day' : ' days') + (h ? ' ' + h + ' hr' : '');
  if (h > 0) return h + ' hr' + (m ? ' ' + m + ' min' : '');
  return m + ' min';
}

export function countdown(t: NightTimes, now: number): { kicker: string; big: string; line: string; phase: CyclePhase } {
  const phase = phaseAt(t, now);
  if (phase === 'prep') return { kicker: 'Until setup', big: span(t.setup - now), line: 'until setup on ' + weekday(t.date) + ' at ' + clock(t.setup), phase };
  if (phase === 'live') return { kicker: 'Tonight', big: 'Live now', line: 'Wraps at ' + clock(t.end), phase };
  if (phase === 'recap') return { kicker: 'Follow-ups', big: span(t.due - now), line: 'left for follow-ups, due ' + when(t.due), phase };
  return { kicker: 'Follow-ups', big: 'Past due', line: 'Follow-ups were due ' + when(t.due), phase };
}

export const dueLine = (t: NightTimes, now: number) => (now > t.due ? 'Overdue since ' + when(t.due) : 'Due ' + when(t.due) + ' · ' + span(t.due - now) + ' left');

/** The meeting nights from today on: the season's dates, then weekly past
 *  the last one — the ministry keeps meeting between seasons. */
export function upcomingNights(meetingDates: string[], today: string, n: number): string[] {
  const sorted = [...new Set(meetingDates)].sort();
  const out = sorted.filter((x) => x >= today).slice(0, n);
  let last = parseLocalISO(out[out.length - 1] ?? sorted[sorted.length - 1] ?? today) ?? new Date();
  while (out.length < n) {
    last = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 7);
    const iso = isoDay(last);
    if (iso >= today) out.push(iso);
  }
  return out;
}

/** The moments a leader can preview the week at (demo only). */
export function previewStages(t: NightTimes): { id: string; short: string; at: number }[] {
  const base = parseLocalISO(t.date) ?? new Date();
  const dayAt = (days: number, hh: number, mm = 0) => new Date(base.getFullYear(), base.getMonth(), base.getDate() - days, hh, mm).getTime();
  return [
    { id: 'd5', short: '5 days out', at: dayAt(5, 12) },
    { id: 'd3', short: '3 days out', at: dayAt(3, 16) },
    { id: 'd1', short: 'Day before', at: dayAt(1, 18) },
    { id: 'morning', short: 'Morning of', at: dayAt(0, 8) },
    { id: 'hour', short: 'An hour out', at: t.setup - 55 * MIN },
    { id: 'live', short: 'During', at: t.doors + 40 * MIN },
    { id: 'after', short: 'Just after', at: t.end + 12 * MIN },
    { id: 'next', short: 'Next day', at: t.end + 22 * HOUR },
    { id: 'late', short: 'Past due', at: t.due + 24 * HOUR }
  ];
}

/* ── reminders ───────────────────────────────────────────────────────── */
export function reminderAt(r: ReminderDef, t: NightTimes): number {
  if (r.beforeMin > 0) return t.setup - r.beforeMin * MIN;
  const base = parseLocalISO(t.date) ?? new Date();
  const [h, m] = (r.time || '09:00').split(':').map((x) => Number(x) || 0);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() - r.days, h, m).getTime();
}

export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (all, k: string) => (k in vars ? vars[k] : all));
}

export function templateVars(d: MinistryData, t: NightTimes): Record<string, string> {
  return {
    week: String(weekOf(d.config.meetingDates, t.date)),
    game: d.config.gameName || 'games and small groups',
    setup: clock(t.setup),
    doors: clock(t.doors),
    pickup: clock(t.pickup),
    place: d.config.cycle.pickupPlace,
    ministry: d.config.ministryName,
    day: weekday(t.date)
  };
}

export interface ReminderView {
  id: string;
  label: string;
  at: number;
  aud: ReminderDef['aud'];
  text: string;
  off: boolean;
  sent: boolean;
  sentAt: number;
  /** Sent by hand ahead of its time. */
  early: boolean;
  status: string;
}

/** A reminder is posted when its time passes, unless it was switched off —
 *  or earlier, by hand. "Posted" means it is in the leaders' notifications
 *  and each family's link; nothing here pretends to send a text. */
export function reminders(d: MinistryData, iso: string, now: number): ReminderView[] {
  const night = nightOf(d, iso);
  const t = nightTimes(d.config.cycle, iso, night.pickupShift);
  const vars = templateVars(d, t);
  return d.config.cycle.reminders
    .map((r) => {
      const o = night.rem[r.id] ?? {};
      const at = reminderAt(r, t);
      const off = !!o.off;
      const sentAt = o.sentAt || (!off && now >= at ? at : 0);
      return {
        id: r.id,
        label: r.label,
        at,
        aud: r.aud,
        text: fillTemplate(o.text ?? r.text, vars),
        off,
        sent: !!sentAt,
        sentAt,
        early: !!o.sentAt && o.sentAt < at,
        status: sentAt ? 'Posted ' + when(sentAt) : off ? 'Off' : 'Scheduled · ' + span(at - now) + ' from now'
      };
    })
    .sort((a, b) => a.at - b.at);
}

export const nextReminder = (list: ReminderView[]) => list.find((r) => !r.sent && !r.off) ?? null;

/* ── who's who ───────────────────────────────────────────────────────── */
const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n;
const stripTitle = (n: string) => n.replace(/^(pastor|coach|mr\.?|mrs\.?|ms\.?|dr\.?)\s+/i, '').trim();

/** The serving name a signed-in person goes by: their crew row when the
 *  name lines up ("Coach Chris" is crew "Chris Alder"), else their own. */
export function selfName(d: MinistryData, displayName: string): string {
  const pool = servePool(d);
  if (pool.includes(displayName)) return displayName;
  const bare = stripTitle(displayName).toLowerCase();
  const hit = pool.find((n) => n.toLowerCase() === bare) ?? pool.find((n) => firstName(n).toLowerCase() === firstName(bare));
  return hit ?? displayName;
}

/** The coach a student's follow-up goes to: one of their squad's coaches,
 *  the same one every week. Null when the squad has none on the crew. */
export function coachFor(d: MinistryData, team: string | null, student: string): string | null {
  if (!team) return null;
  const coaches = d.huddle.crew.filter((c) => c.team === team && /coach|small group/i.test(c.job)).map((c) => c.name).sort();
  if (!coaches.length) return null;
  let h = 0;
  for (const ch of student) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return coaches[h % coaches.length];
}

/* ── attendance ──────────────────────────────────────────────────────── */
/** The last `n` meeting nights before `iso`, oldest first: present or not. */
export function history(d: MinistryData, name: string, iso: string, n = 6): boolean[] {
  const past = [...new Set(d.config.meetingDates)].filter((x) => x < iso).sort().slice(-n);
  return past.map((x) => (d.presenceLog[x] ?? []).includes(name));
}

export function attendanceStats(d: MinistryData) {
  const here = Object.entries(d.tonight.presence).filter(([, v]) => v).map(([k]) => k);
  const guests = new Set(d.roster.filter((s) => s.guest).map((s) => s.name));
  return {
    total: d.roster.filter((s) => !s.guest).length,
    here: here.length,
    qr: here.filter((n) => d.tonight.via?.[n] === 'qr').length,
    leader: here.filter((n) => d.tonight.via?.[n] !== 'qr').length,
    visitors: here.filter((n) => guests.has(n)).length
  };
}

/* ── follow-ups ──────────────────────────────────────────────────────── */
export const FU_KINDS = [
  { id: 'welcome', label: 'New visitor welcome', icon: 'ph-hand-waving' },
  { id: 'missed', label: 'Missed-you check-in', icon: 'ph-chat-circle-dots' },
  { id: 'prayer', label: 'Prayer request follow-up', icon: 'ph-hands-praying' },
  { id: 'thanks', label: 'Thank-you to volunteers', icon: 'ph-heart' }
] as const;
export type FuKind = (typeof FU_KINDS)[number]['id'];

export interface FollowUp {
  id: string;
  kind: FuKind;
  /** A crew name, or null for "the leaders". */
  owner: string | null;
  title: string;
  sub: string;
  draft: string;
  /** Someone else's prayer request: you see that it exists, not what it says. */
  private: boolean;
  done: boolean;
  doneAt: number;
  text: string;
  overdue: boolean;
  mine: boolean;
}

export interface Viewer {
  /** Serving name (see selfName). */
  name: string;
  /** Leaders own the unassigned items and read every prayer request. */
  leader: boolean;
}

/** Built from the night itself: who came for the first time, which regulars
 *  were missing, what was shared, who served. Empty until the night wraps. */
export function followups(d: MinistryData, iso: string, now: number, me: Viewer): FollowUp[] {
  const night = nightOf(d, iso);
  const t = nightTimes(d.config.cycle, iso, night.pickupShift);
  if (!isAfter(t, now)) return [];
  const out: Omit<FollowUp, 'done' | 'doneAt' | 'text' | 'overdue' | 'mine'>[] = [];
  const present = (n: string) => !!d.tonight.presence[n];
  const fam = (n: string): Family | undefined => d.families[n];
  const day = weekday(iso);
  const doors = clock(t.doors);

  /* First-timers: guests checked in tonight, and friends logged as new. */
  const seen = new Set<string>();
  const welcome = (name: string, team: string | null, came: string | null) => {
    if (seen.has(name)) return;
    seen.add(name);
    const f = fam(name);
    out.push({
      id: 'w-' + name,
      kind: 'welcome',
      owner: coachFor(d, team, name),
      title: 'Welcome ' + name,
      sub: (came ? 'Came with ' + came + '. ' : '') + (f?.guardian ? 'Guardian ' + f.guardian + (f.contact ? ' · ' + f.contact : '') : 'No guardian on file yet'),
      draft: 'Hi ' + (f?.guardian ? firstName(f.guardian) : 'there') + ', ' + firstName(name) + ' joined us at ' + d.config.ministryName + ' tonight. We loved having them. We meet ' + day + 's at ' + doors + ' if they want to come back.',
      private: false
    });
  };
  for (const s of d.roster) if (s.guest && present(s.name) && !history(d, s.name, iso).some(Boolean)) welcome(s.name, s.team, null);
  const week = weekOf(d.config.meetingDates, iso);
  for (const v of d.visitorLog.filter((x) => x.week === week && x.kind === 'new')) for (const n of v.names) welcome(n, v.team || null, v.student);

  /* Regulars who weren't here: present at least half of the last six. */
  for (const s of d.roster) {
    if (s.guest || present(s.name)) continue;
    const h = history(d, s.name, iso);
    const n = h.filter(Boolean).length;
    if (!h.length || n * 2 < h.length) continue;
    const missedLast = h[h.length - 1] === false;
    out.push({
      id: 'm-' + s.name,
      kind: 'missed',
      owner: coachFor(d, s.team, s.name),
      title: 'Check in with ' + s.name,
      sub: missedLast ? 'Second week in a row' : 'Usually here · ' + n + ' of last ' + h.length,
      draft: 'Hey ' + firstName(s.name) + ', missed you tonight' + (d.config.gameName ? ' — we ran ' + d.config.gameName : '') + '. Everything okay?',
      private: false
    });
  }

  /* Prayer shared during the night. Leaders read them; everyone else sees
     that one exists and who has it. */
  const inNight = (at: number) => at >= t.setup - HOUR && at <= t.end + HOUR;
  const prayers = [...d.prayerQueue.filter((p) => inNight(p.at)), ...d.prayers.filter((p) => inNight(p.at))];
  for (const p of prayers) {
    out.push({
      id: 'p-' + p.id,
      kind: 'prayer',
      owner: null,
      title: me.leader ? 'Pray with ' + p.who : 'Prayer request from ' + firstName(p.who),
      sub: me.leader ? p.body : 'Private · only the leaders can read this',
      draft: me.leader && p.who !== 'Anonymous' ? 'Hi ' + firstName(p.who) + ', I’ve been praying for this since ' + day + '. How is it going?' : '',
      private: !me.leader
    });
  }

  /* Everyone who served and showed up. */
  for (const c of d.huddle.crew) {
    if (d.huddle.crewState[c.id] !== 'here') continue;
    out.push({
      id: 't-' + c.id,
      kind: 'thanks',
      owner: null,
      title: 'Thank ' + c.name,
      sub: c.job + (c.post ? ' · ' + c.post : ''),
      draft: 'Thanks for serving tonight, ' + firstName(c.name) + '. It made the night run.',
      private: false
    });
  }

  return out.map((f) => {
    const o = night.fu[f.id] ?? {};
    const mine = f.owner ? f.owner === me.name : me.leader;
    return { ...f, done: !!o.done, doneAt: o.at ?? 0, text: o.text ?? f.draft, overdue: !o.done && now > t.due, mine };
  });
}

/* ── serving ─────────────────────────────────────────────────────────── */
/** Everyone who could take a spot: the crew, the bench, accepted invites and
 *  anyone already on the schedule. */
export function servePool(d: MinistryData): string[] {
  const names = [
    ...d.huddle.crew.map((c) => c.name),
    ...d.huddle.bench.map((b) => b.name),
    ...d.serving.invites.filter((i) => i.status === 'accepted').map((i) => i.name),
    ...(d.people ?? []).filter((p) => p.role !== 'member' && p.role !== 'captain').map((p) => p.name),
    ...(Object.values(d.serving.sched).filter(Boolean) as string[])
  ];
  return [...new Set(names.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export const whoServes = (d: MinistryData, night: string, role: string): string | null => d.serving.sched[night + '|' + role] ?? null;
export const availOf = (d: MinistryData, name: string, night: string) => d.serving.avail[name + '|' + night] ?? null;

export function myNights(d: MinistryData, name: string, nights: string[]) {
  const out: { night: string; role: string; pending: boolean }[] = [];
  for (const n of nights)
    for (const r of d.config.cycle.serveRoles)
      if (whoServes(d, n, r) === name)
        out.push({ night: n, role: r, pending: d.serving.swaps.some((s) => s.status === 'pending' && s.from === name && s.night === n && s.role === r) });
  return out;
}

export function openSpots(d: MinistryData, nights: string[]) {
  const out: { night: string; role: string }[] = [];
  for (const n of nights) for (const r of d.config.cycle.serveRoles) if (!whoServes(d, n, r)) out.push({ night: n, role: r });
  return out;
}

/* ── families ────────────────────────────────────────────────────────── */
export function slipKids(d: MinistryData, slip: PermissionSlip): string[] {
  const names = new Set(d.roster.map((s) => s.name));
  return slip.kids === 'all' ? d.roster.filter((s) => !s.guest).map((s) => s.name) : slip.kids.filter((n) => names.has(n));
}

export function slipDueLabel(slip: PermissionSlip, today: string): string {
  const [day, time] = slip.due.split('T');
  const ms = time ? atLocal(day, time) : atLocal(day, '23:59');
  if (day === today) return 'Due by ' + clock(ms) + ' tonight';
  return 'Due ' + (time ? when(ms) : dayLabel(ms));
}

export function slipsView(d: MinistryData) {
  return d.slips.map((slip) => {
    const kids = slipKids(d, slip).map((name) => {
      const s = d.slipSigned[slip.id + '|' + name];
      return { name, guardian: d.families[name]?.guardian ?? '', signed: !!s, by: s?.by ?? '' };
    });
    return { slip, kids, signedN: kids.filter((k) => k.signed).length, total: kids.length };
  });
}

export function audienceKids(d: MinistryData, to: string): string[] {
  if (to === 'all') return d.roster.filter((s) => !s.guest || d.families[s.name]).map((s) => s.name);
  if (to.startsWith('slip:') || to.startsWith('unsigned:')) {
    const id = to.slice(to.indexOf(':') + 1);
    const v = slipsView(d).find((x) => x.slip.id === id);
    if (!v) return [];
    return (to.startsWith('unsigned:') ? v.kids.filter((k) => !k.signed) : v.kids).map((k) => k.name);
  }
  return d.roster.some((s) => s.name === to) ? [to] : [];
}

export function audienceLabel(d: MinistryData, to: string): string {
  if (to === 'all') return 'All families';
  if (to.startsWith('slip:') || to.startsWith('unsigned:')) {
    const slip = d.slips.find((s) => s.id === to.slice(to.indexOf(':') + 1));
    return (to.startsWith('unsigned:') ? 'Unsigned · ' : '') + (slip?.title ?? 'a slip');
  }
  const g = d.families[to]?.guardian;
  return g ? g + ' (' + firstName(to) + ')' : to;
}

export interface FeedItem {
  id: string;
  from: string;
  text: string;
  at: number;
  read: boolean;
  kind: 'msg' | 'reminder';
}

/** What one family sees: leader messages that reached their student, plus
 *  any reminder addressed to parents that has gone out. */
export function familyFeed(d: MinistryData, kid: string, iso: string, now: number): FeedItem[] {
  const list: FeedItem[] = d.parentMsgs
    .filter((m) => m.kids.includes(kid))
    .map((m) => ({ id: m.id, from: m.from, text: m.text, at: m.at, read: !!m.reads[kid], kind: 'msg' as const }));
  for (const r of reminders(d, iso, now)) if (r.sent && r.aud.includes('parents')) list.push({ id: 'rem-' + iso + '-' + r.id, from: d.config.ministryName, text: r.text, at: r.sentAt, read: true, kind: 'reminder' });
  return list.sort((a, b) => b.at - a.at);
}

export function newFamilyToken(): string {
  const a = new Uint8Array(20);
  globalThis.crypto.getRandomValues(a);
  return Array.from(a, (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
}

export function newMessage(d: MinistryData, from: string, to: string, text: string, at: number, id: string): ParentMessage {
  return { id, from, to, kids: audienceKids(d, to), text, at, reads: {} };
}

/* ── what needs a leader ─────────────────────────────────────────────── */
export interface CycleNeed {
  id: string;
  icon: string;
  title: string;
  meta: string;
  href: string;
}

export function cycleNeeds(d: MinistryData, iso: string, now: number, me: Viewer): CycleNeed[] {
  const out: CycleNeed[] = [];
  const night = nightOf(d, iso);
  const t = nightTimes(d.config.cycle, iso, night.pickupShift);
  const flags = night.doorFlags.filter((f) => !f.done);
  if (flags.length)
    out.push({ id: 'cy-door', icon: 'ph-door-open', title: flags.length === 1 ? flags[0].name + ' is at the door, not on a roster' : flags.length + ' people at the door, not on a roster', meta: 'Go say hi and check them in from the recap', href: '/dashboard/night-recap' });
  const pend = d.serving.swaps.filter((s) => s.status === 'pending');
  if (pend.length)
    out.push({ id: 'cy-swaps', icon: 'ph-swap', title: pend.length + (pend.length === 1 ? ' swap request' : ' swap requests') + ' to approve', meta: pend.map((s) => s.from + ' · ' + s.role).join(' · '), href: '/dashboard/serving' });
  if (!isAfter(t, now)) {
    const today = isoDay(new Date(now));
    for (const v of slipsView(d)) {
      if (v.signedN >= v.total || v.slip.due.split('T')[0] !== iso) continue;
      out.push({ id: 'cy-slip-' + v.slip.id, icon: 'ph-signature', title: v.total - v.signedN + (v.total - v.signedN === 1 ? ' slip' : ' slips') + ' unsigned · ' + v.slip.title, meta: slipDueLabel(v.slip, today), href: '/dashboard/parents' });
    }
  } else {
    const fu = followups(d, iso, now, me).filter((f) => f.mine && !f.done);
    if (fu.length) out.push({ id: 'cy-fu', icon: 'ph-envelope-simple', title: fu.length + ' follow-ups are yours', meta: dueLine(t, now), href: '/dashboard/night-recap' });
  }
  return out;
}

/** A student who can check themselves in right now, or why not. */
export function selfCheckin(d: MinistryData, student: Student | undefined, now: number): { ok: boolean; why: string; via?: CheckinVia } {
  if (!student) return { ok: false, why: 'You’re not on a roster yet — find a leader at the door.' };
  const iso = d.tonight.date;
  if (!d.config.meetingDates.includes(iso) || iso !== isoDay(new Date(now))) return { ok: false, why: 'Check-in opens on meeting nights.' };
  const t = nightTimes(d.config.cycle, iso, nightOf(d, iso).pickupShift);
  if (now < t.checkinOpen) return { ok: false, why: 'Check-in opens at ' + clock(t.checkinOpen) + '.' };
  if (now >= t.end) return { ok: false, why: 'Tonight’s check-in has closed.' };
  if (d.tonight.presence[student.name]) return { ok: false, why: 'You’re checked in.' };
  return { ok: true, why: '', via: 'qr' };
}

/* ── what one family sees ────────────────────────────────────────────── */
export interface FamilyView {
  ministry: string;
  kid: string;
  first: string;
  team: { name: string; color: string } | null;
  coach: string | null;
  guardian: string;
  phase: CyclePhase;
  kicker: string;
  title: string;
  status: string;
  here: boolean;
  pickup: string;
  pickupPlace: string;
  /** Last six nights, oldest first; then tonight once check-in has opened. */
  hist: boolean[];
  histTonight: boolean | null;
  plan: { at: string; label: string }[];
  slips: { id: string; title: string; due: string; signed: boolean; by: string }[];
  feed: FeedItem[];
  unread: number;
}

/** Built from the same data the leaders' screens read, so what a parent is
 *  told can't drift from what the leaders see. Staff-only run-sheet blocks
 *  (the huddle, the debrief) and every note are left out. */
export function familyView(d: MinistryData, kid: string, now: number): FamilyView | null {
  const s = d.roster.find((r) => r.name === kid);
  if (!s) return null;
  const iso = d.tonight.date;
  const night = nightOf(d, iso);
  const t = nightTimes(d.config.cycle, iso, night.pickupShift);
  const phase = phaseAt(t, now);
  const team = d.teams.find((x) => x.id === s.team) ?? null;
  const coach = coachFor(d, s.team, s.name);
  const first = firstName(s.name);
  const here = !!d.tonight.presence[s.name];
  const via = d.tonight.via?.[s.name];
  const after = phase === 'recap' || phase === 'late';
  const live = phase === 'live';
  const group = coach ? ' Small group with ' + coach + '.' : '';
  const today = isoDay(new Date(now));
  const feed = familyFeed(d, s.name, iso, now);
  return {
    ministry: d.config.ministryName,
    kid: s.name,
    first,
    team: team ? { name: team.name, color: team.color } : null,
    coach,
    guardian: d.families[s.name]?.guardian ?? '',
    phase,
    kicker: after ? 'Last night' : live ? 'Tonight · live' : weekday(iso),
    title: after ? (here ? first + ' was there' : first + ' missed this week') : live ? (here ? first + ' is checked in' : first + ' hasn’t checked in') : d.config.gameName || 'This week',
    status: here
      ? 'Checked in ' + (via === 'qr' ? 'at the door' : 'by a leader') + '.' + group
      : after
        ? 'We missed them.' + (coach ? ' ' + coach + ' may reach out this week.' : '')
        : clock(t.doors) + ' to ' + clock(t.pickup) + (d.config.venueAddress ? ' · ' + d.config.venueAddress.split('·')[0].trim() : '') + '.' + group,
    here,
    pickup: clock(t.pickup),
    pickupPlace: d.config.cycle.pickupPlace,
    hist: history(d, s.name, iso),
    histTonight: now >= t.checkinOpen ? here : null,
    plan: d.huddle.runSheet
      .filter((it) => !it.debrief && !/huddle/i.test(it.label))
      .map((it) => ({ at: it.time.replace(/(am|pm)$/i, ''), label: /^doors/i.test(it.label) ? 'Doors open, hang out' : /^send/i.test(it.label) ? 'Send-off, then pickup' : it.label })),
    slips: slipsView(d)
      .filter((v) => v.kids.some((k) => k.name === s.name))
      .map((v) => {
        const k = v.kids.find((x) => x.name === s.name)!;
        return { id: v.slip.id, title: v.slip.title, due: slipDueLabel(v.slip, today), signed: k.signed, by: k.by };
      }),
    feed,
    unread: feed.filter((f) => !f.read).length
  };
}
