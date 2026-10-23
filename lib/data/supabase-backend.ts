'use client';
/* SUPABASE MODE — the ministry lives in the database. Each change is written
   as it happens; row-level security (supabase/migrations) decides what any
   role can read or write, from the same constants the UI reads.

   Score entries are the exception to "write as it happens": they go through
   the outbox, and pushEntries() is idempotent on the client-generated id, so
   a replay over a flaky connection can never double-post. */
import type { Backend, RemotePatch, SyncEvent } from '@/lib/data/backend';
import { DEFAULT_CONFIG, emptyMinistry } from '@/lib/data/empty';
import { bibleStats } from '@/lib/bible';
import { isoDay, periodKey, tonightDate, weekOf } from '@/lib/dates';
import { supabaseBrowser } from '@/lib/supabase/client';
import { chatStamp } from '@/lib/selectors';
import type { Persona, ScoreEntryStatus } from '@/lib/types/domain';
import type {
  AccessRequest, Category, ChatMessage, ChatThread, PersonRow, LedgerEntry, Membership, MinistryConfig, MinistryData, MinistryEvent, Rsvp, RsvpCount,
  Student, Team
} from '@/lib/types/model';

interface EntryRow {
  id: string;
  org_id: string;
  team_id: string;
  category_key: string;
  amount: number;
  reason: string;
  student_name: string | null;
  detail: LedgerEntry['detail'];
  batch_id: string | null;
  reverses: string | null;
  status: ScoreEntryStatus;
  entered_by: string | null;
  entered_by_name: string;
  created_at: string;
  decided_by_name: string | null;
  decided_at: string | null;
}

const toEntry = (r: EntryRow): LedgerEntry => ({
  id: r.id,
  team: r.team_id,
  cat: r.category_key,
  amount: r.amount,
  by: r.entered_by_name,
  byMembershipId: r.entered_by,
  why: r.reason,
  at: new Date(r.created_at).getTime(),
  status: r.status,
  student: r.student_name,
  detail: r.detail,
  batch: r.batch_id,
  reverses: r.reverses,
  decidedBy: r.decided_by_name,
  decidedAt: r.decided_at ? new Date(r.decided_at).getTime() : null
});

const ALL_AUDIENCES = ['members', 'captains', 'coaches', 'scorekeeper', 'leaders', 'parents', 'admins'] as const;

interface ChatRow {
  id: string;
  thread_id: string;
  author: string | null;
  author_name: string;
  role_label: string;
  body: string;
  created_at: string;
}

function toChat(r: ChatRow, me: string | null): ChatMessage {
  const at = new Date(r.created_at).getTime();
  return { id: r.id, at, ...chatStamp(at), from: r.author_name, roleLabel: r.role_label, text: r.body, mine: !!me && r.author === me, status: 'sent' };
}

function countsFrom(rows: unknown): Record<string, RsvpCount> {
  const out: Record<string, RsvpCount> = {};
  for (const r of (rows ?? []) as { event_id: string; going: number; maybe: number; out_count: number; guests: number }[]) {
    out[r.event_id] = { going: r.going, maybe: r.maybe, out: r.out_count, guests: r.guests };
  }
  return out;
}

const STAFF: Persona[] = ['leader', 'owner', 'scorekeeper', 'coach'];
/** The threads chat_can() allows, as the list screen shows them. */
function chatThreads(teams: Team[], rosterSize: number, m: Membership): ChatThread[] {
  const all: Persona[] = ['leader', 'owner', 'scorekeeper', 'coach', 'captain', 'member'];
  const out: ChatThread[] = [
    { id: 'all', kind: 'announce', name: 'Announcements', sub: rosterSize + ' students', icon: 'ph-fill ph-megaphone', tint: '#3a3860', read: all, post: STAFF },
    { id: 'leaders', kind: 'group', name: 'Leaders & coaches', sub: 'the volunteer set', icon: 'ph-fill ph-users-three', tint: '#26404d', read: STAFF, post: STAFF }
  ];
  for (const t of teams) {
    if (!STAFF.includes(m.persona) && m.teamId !== t.id) continue;
    out.push({ id: 'team-' + t.id, kind: 'team', name: t.name + ' Squad', sub: 'squad thread', icon: 'ph-fill ph-shield-check', tint: t.color, read: all, post: all, team: t.id });
  }
  return out;
}

export function supabaseBackend(membership: Membership): Backend {
  const db = supabaseBrowser();
  const org = membership.orgId!;
  /* name ↔ id for the roster: the app finds students by name on the floor. */
  let studentIds = new Map<string, string>();
  let queue: Promise<unknown> = Promise.resolve();
  /** A student's row id by name — from the load, else asked for. */
  const sidFor = async (name: string) => {
    const known = studentIds.get(name);
    if (known) return known;
    const r = await db.from('students').select('id').eq('org_id', org).eq('name', name).maybeSingle();
    const id = (r.data as { id: string } | null)?.id;
    if (id) studentIds.set(name, id);
    return id ?? null;
  };

  let tonight = '';

  const must = <T,>(res: { data: T | null; error: { message: string } | null }): T => {
    if (res.error) throw new Error(res.error.message);
    return res.data as T;
  };

  /* One change, written where it lives. RLS decides whether it lands. */
  const apply = async (e: SyncEvent): Promise<void> => {
      switch (e.kind) {
        case 'activity':
          await db.from('activity_log').insert({ id: e.line.id, org_id: org, actor: membership.membershipId, line: e.line.line, created_at: new Date(e.line.at).toISOString() });
          return;
        case 'prayerSubmit':
          await db.from('prayer_requests').insert({ id: e.item.id, org_id: org, author: membership.membershipId, who: e.item.who, meta: e.item.meta, body: e.item.body });
          return;
        case 'prayerPost':
          await db.from('prayer_requests').update({ status: 'wall' }).in('id', e.ids);
          return;
        case 'prayerHold':
          await db.from('prayer_requests').update({ status: 'held' }).eq('id', e.id);
          return;
        case 'prayerPraying':
          await db.rpc('set_praying', { p_request: e.id, p_on: e.on });
          return;
        case 'prayerAnswered':
          await db.from('prayer_requests').update({ answered: e.on }).eq('id', e.id);
          return;
        case 'careAdd':
          await db.from('care_notes').insert({ id: e.item.id, org_id: org, name: e.item.name, meta: e.item.meta, flagged_by: e.item.flaggedBy ?? '', kind: e.item.kind ?? 'followup', body: e.item.body ?? '' });
          return;
        case 'careDone':
          await db.from('care_notes').update({ done: true }).eq('id', e.id);
          return;
        case 'accessDecide':
          await db.rpc('decide_access', { p_request: e.request.id, p_approve: e.approve });
          return;
        case 'huddle':
          await db.from('nights').upsert({ org_id: org, meeting_date: tonight, huddle: e.huddle, updated_at: new Date().toISOString() });
          return;
        case 'game':
          await db.from('nights').upsert({ org_id: org, meeting_date: tonight, game: e.game, updated_at: new Date().toISOString() });
          return;
        case 'config':
          await db.from('organizations').update({ name: e.config.ministryName, config: e.config }).eq('id', org);
          return;
        case 'doc':
          await db.from('ministry_docs').upsert({ org_id: org, key: e.key, value: e.value, updated_at: new Date().toISOString() });
          return;
        case 'media': {
          const path = e.item.path ?? org + '/' + e.item.week + '/' + e.item.id;
          const up = await db.storage.from('media').upload(path, e.file, { contentType: e.file.type || 'application/octet-stream', upsert: true });
          if (up.error) throw up.error;
          const ins = await db.from('media_items').upsert(
            { id: e.item.id, org_id: org, week: e.item.week, kind: e.item.kind, label: e.item.label, path, created_by: membership.membershipId, created_by_name: e.item.by ?? '' },
            { onConflict: 'id', ignoreDuplicates: true }
          );
          if (ins.error) throw ins.error;
          return;
        }
        case 'mediaRemove':
          if (e.path) await db.storage.from('media').remove([e.path]);
          await db.from('media_items').delete().eq('id', e.id);
          return;
        case 'team':
          await db.from('teams').upsert({ id: e.team.id, org_id: org, name: e.team.name, color: e.team.color, mascot_name: e.team.mascotName, mascot_story: e.team.mascotStory, sort: e.team.sort });
          return;
        case 'teamRemove':
          await db.from('teams').update({ archived: true }).eq('id', e.id);
          return;
        case 'category':
          await db.from('categories').upsert(
            { org_id: org, key: e.cat.id, label: e.cat.label, color: e.cat.color, icon: e.cat.icon, hint: e.cat.hint, sort: e.sort },
            { onConflict: 'org_id,key' }
          );
          return;
        case 'categoryRemove':
          await db.from('categories').update({ archived: true }).eq('org_id', org).eq('key', e.id);
          return;
        case 'student': {
          const res = await db
            .from('students')
            .upsert({ id: e.student.id, org_id: org, name: e.student.name, team_id: e.student.team, grade: e.student.grade, captain: !!e.student.captain, guest: !!e.student.guest, new_in_db: !!e.student.newInDb })
            .select('id')
            .single();
          if (res.data) studentIds.set(e.student.name, (res.data as { id: string }).id);
          return;
        }
        case 'presence': {
          const sid = await sidFor(e.student);
          if (!sid) return;
          await db.from('attendance').upsert({ org_id: org, meeting_date: e.date || tonight, student_id: sid, present: e.present, via: e.via ?? 'leader', marked_by: membership.membershipId, updated_at: new Date().toISOString() });
          return;
        }
        case 'selfCheckin': {
          const r = await db.rpc('self_check_in', { p_org: org, p_date: e.date || tonight });
          if (r.error) throw r.error;
          return;
        }
        /* ── the week around the night ── */
        case 'reminder': {
          const r = await db.from('night_reminders').upsert({ org_id: org, meeting_date: e.date, reminder_id: e.id, off: !!e.rec.off, sent_at: e.rec.sentAt ? new Date(e.rec.sentAt).toISOString() : null, body: e.rec.text ?? null, updated_at: new Date().toISOString() });
          if (r.error) throw r.error;
          return;
        }
        case 'followup': {
          const r = await db.from('night_followups').upsert({ org_id: org, meeting_date: e.date, item_id: e.id, done: !!e.rec.done, done_at: e.rec.done && e.rec.at ? new Date(e.rec.at).toISOString() : null, body: e.rec.text ?? null, done_by: e.rec.by ?? '' });
          if (r.error) throw r.error;
          return;
        }
        case 'nightNotes': {
          const r = await db.from('night_notes').upsert({ org_id: org, meeting_date: e.date, went_well: e.notes.well, change_next: e.notes.change, updated_at: new Date().toISOString() });
          if (r.error) throw r.error;
          return;
        }
        case 'pickup': {
          const r = await db.from('night_pickup').upsert({ org_id: org, meeting_date: e.date, shift_min: e.shift });
          if (r.error) throw r.error;
          return;
        }
        case 'doorFlag': {
          const r = await db.from('door_flags').upsert({ id: e.flag.id, org_id: org, meeting_date: e.date, name: e.flag.name, done: !!e.flag.done, created_at: new Date(e.flag.at).toISOString() });
          if (r.error) throw r.error;
          return;
        }
        case 'serve': {
          const r = await db.from('serve_schedule').upsert({ org_id: org, meeting_date: e.night, role: e.role, name: e.name });
          if (r.error) throw r.error;
          return;
        }
        case 'avail': {
          const r = e.state
            ? await db.from('serve_availability').upsert({ org_id: org, name: e.name, meeting_date: e.night, state: e.state })
            : await db.from('serve_availability').delete().eq('org_id', org).eq('name', e.name).eq('meeting_date', e.night);
          if (r.error) throw r.error;
          return;
        }
        case 'swap': {
          const row = { id: e.swap.id, org_id: org, from_name: e.swap.from, meeting_date: e.swap.night, role: e.swap.role, to_name: e.swap.to, why: e.swap.why, status: e.swap.status, decided_by: e.swap.decidedBy ?? null, created_at: new Date(e.swap.at).toISOString() };
          /* Asking is an insert (as yourself, pending); deciding is an update. */
          const r = e.swap.status === 'pending' ? await db.from('serve_swaps').insert(row) : await db.from('serve_swaps').update({ status: row.status, to_name: row.to_name, decided_by: row.decided_by }).eq('id', row.id);
          if (r.error) throw r.error;
          return;
        }
        case 'invite': {
          const r = await db.from('volunteer_invites').upsert({ id: e.invite.id, org_id: org, name: e.invite.name, contact: e.invite.contact, role: e.invite.role, status: e.invite.status, created_at: new Date(e.invite.at).toISOString() });
          if (r.error) throw r.error;
          return;
        }
        case 'family': {
          const sid = await sidFor(e.student);
          if (!sid) return;
          const r = await db.from('families').upsert({ org_id: org, student_id: sid, guardian: e.family.guardian, contact: e.family.contact, token: e.family.token });
          if (r.error) throw r.error;
          return;
        }
        case 'slip': {
          const r = await db.from('permission_slips').upsert({ id: e.slip.id, org_id: org, title: e.slip.title, due: e.slip.due, kids: e.slip.kids === 'all' ? null : e.slip.kids, created_at: new Date(e.slip.at).toISOString() });
          if (r.error) throw r.error;
          return;
        }
        case 'slipRemove':
          await db.from('permission_slips').delete().eq('id', e.id);
          return;
        case 'slipSign': {
          const sid = await sidFor(e.student);
          if (!sid) return;
          const r = e.by
            ? await db.from('slip_signatures').upsert({ slip_id: e.slip, student_id: sid, org_id: org, signed_by: e.by })
            : await db.from('slip_signatures').delete().eq('slip_id', e.slip).eq('student_id', sid);
          if (r.error) throw r.error;
          return;
        }
        case 'parentMsg': {
          const r = await db.from('parent_messages').insert({ id: e.msg.id, org_id: org, author: membership.membershipId, from_name: e.msg.from, audience: e.msg.to, kids: e.msg.kids, body: e.msg.text, created_at: new Date(e.msg.at).toISOString() });
          if (r.error) throw r.error;
          return;
        }
        case 'chat': {
          const r = await db.from('chat_messages').upsert(
            { id: e.msg.id, org_id: org, thread_id: e.threadId, author: membership.membershipId, author_name: membership.displayName, role_label: e.msg.roleLabel ?? '', body: e.msg.text },
            { onConflict: 'id', ignoreDuplicates: true }
          );
          if (r.error) throw r.error;
          return;
        }
        case 'rsvp': {
          if (!membership.membershipId) return;
          const r = await db.from('rsvps').upsert(
            { event_id: e.eventId, org_id: org, membership_id: membership.membershipId, name: e.name, status: e.rec.status, guests: e.rec.guests, updated_at: new Date().toISOString() },
            { onConflict: 'event_id,membership_id' }
          );
          if (r.error) throw r.error;
          return;
        }
        case 'event': {
          const ev = e.event;
          const r = await db.from('events').upsert({
            id: ev.id, org_id: org, title: ev.title, meta: ev.meta, date_label: ev.date, color: ev.color, audiences: ev.roles,
            day: ev.iso ?? null, time_label: ev.time ?? '', place: ev.place ?? '', status: ev.status ?? 'approved', proposed_by: ev.by ?? '', rsvp_closed: !!ev.rsvpClosed
          });
          if (r.error) throw r.error;
          return;
        }
        case 'vote': {
          if (!membership.membershipId) return;
          const r = await db.from('award_votes').insert({ org_id: org, award_id: e.awardId, period: e.period, membership_id: membership.membershipId, choice: e.choice });
          if (r.error && r.error.code !== '23505') throw r.error;
          return;
        }
        case 'nominee': {
          const r = await db.from('award_nominees').upsert({ id: e.id, org_id: org, award_id: e.awardId, name: e.name, nominated_by: membership.membershipId }, { onConflict: 'id', ignoreDuplicates: true });
          if (r.error) throw r.error;
          return;
        }
        case 'libraryShare': {
          const u = e.unit;
          const r = await db.from('library_units').upsert({
            id: u.id, org_id: org, kind: u.kind, title: u.title, church_name: u.church ?? '', span: u.span, theme: u.theme, summary: u.summary, includes: u.includes, pts: u.pts, shared: true
          });
          if (r.error) throw r.error;
          return;
        }
        case 'person': {
          const r = await db.from('memberships').update({ role: e.person.role, team_id: e.person.teamId, student_name: e.person.studentName, display_name: e.person.name }).eq('id', e.person.id);
          if (r.error) throw r.error;
          return;
        }
        case 'studentRemove':
          await db.from('students').delete().eq('id', e.id);
          return;
        case 'personRemove':
          await db.from('memberships').delete().eq('id', e.id);
          return;
        case 'rotateInvite':
          await db.rpc('rotate_invite_code', { p_org: org });
          return;
        case 'eventRemove':
          await db.from('events').delete().eq('id', e.id);
          return;
        case 'practice':
          if (!membership.membershipId) return;
          await db.from('practice_log').upsert(
            { id: e.row.id, org_id: org, membership_id: membership.membershipId, who: e.row.who, team_id: e.row.team, day: e.row.day, ref: e.row.ref, mode: e.row.mode },
            { onConflict: 'membership_id,day', ignoreDuplicates: true }
          );
          return;
      }
  };

  const backend: Backend = {
    mode: 'supabase',

    async load(): Promise<MinistryData> {
      const d = emptyMinistry();
      const since = new Date();
      since.setDate(since.getDate() - 60);
      const [orgRow, teams, cats, students, entries, prayers, care, events, challenges, access, log, docs, practice, media] = await Promise.all([
        db.from('organizations').select('id, name, config, invite_code').eq('id', org).single(),
        db.from('teams').select('*').eq('org_id', org).eq('archived', false).order('sort'),
        db.from('categories').select('*').eq('org_id', org).eq('archived', false).order('sort'),
        db.from('students').select('*').eq('org_id', org).order('name'),
        db.from('score_entries').select('*').eq('org_id', org).order('created_at', { ascending: false }).limit(5000),
        db.from('prayer_requests').select('*').eq('org_id', org).order('created_at', { ascending: false }).limit(200),
        db.from('care_notes').select('*').eq('org_id', org).eq('done', false).order('created_at', { ascending: false }),
        db.from('events').select('*').eq('org_id', org).order('created_at'),
        db.from('challenges').select('*').eq('org_id', org).order('created_at'),
        db.from('access_requests').select('*').eq('org_id', org).eq('status', 'pending').order('created_at'),
        db.from('activity_log').select('*').eq('org_id', org).order('created_at', { ascending: false }).limit(200),
        db.from('ministry_docs').select('key, value').eq('org_id', org),
        db.from('practice_log').select('*').eq('org_id', org).gte('day', isoDay(since)).order('day', { ascending: false }).limit(5000),
        db.from('media_items').select('*').eq('org_id', org).order('created_at', { ascending: false }).limit(1000)
      ]);

      const o = must(orgRow) as { name: string; config: Partial<MinistryConfig>; invite_code: string };
      const config: MinistryConfig = { ...DEFAULT_CONFIG, ...o.config, ministryName: o.config.ministryName || o.name, inviteCode: o.invite_code };
      config.church = { ...DEFAULT_CONFIG.church, ...(o.config.church ?? {}) };
      tonight = tonightDate(config.meetingDates);
      if (config.meetingDates.length) config.weekNumber = weekOf(config.meetingDates, tonight);
      d.config = config;

      d.teams = (must(teams) as { id: string; name: string; color: string; mascot_name: string; mascot_story: string; sort: number }[]).map(
        (t): Team => ({ id: t.id, name: t.name, color: t.color, mascotName: t.mascot_name, mascotStory: t.mascot_story, sort: t.sort })
      );
      d.cats = (must(cats) as { key: string; label: string; color: string; icon: string; hint: string }[]).map(
        (c): Category => ({ id: c.key, label: c.label, color: c.color, icon: c.icon, hint: c.hint })
      );
      const studentRows = must(students) as { id: string; name: string; team_id: string | null; grade: string; captain: boolean; guest: boolean; new_in_db: boolean }[];
      studentIds = new Map(studentRows.map((s) => [s.name, s.id]));
      d.roster = studentRows.map(
        (s): Student => ({ id: s.id, name: s.name, team: s.team_id, grade: s.grade, captain: s.captain, guest: s.guest, newInDb: s.new_in_db })
      );
      d.ledger = (must(entries) as EntryRow[]).map(toEntry);
      d.media = ((media.data ?? []) as { id: string; week: number; kind: 'photo' | 'video' | 'audio'; label: string; path: string | null; created_by_name: string; created_at: string }[]).map((r) => ({
        id: r.id, week: r.week, kind: r.kind, label: r.label, path: r.path, by: r.created_by_name, at: new Date(r.created_at).getTime()
      }));
      d.practiceLog = ((practice.data ?? []) as { id: string; who: string; team_id: string | null; day: string; ref: string; mode: string; created_at: string }[]).map((r) => ({
        id: r.id, who: r.who, team: r.team_id, day: r.day, ref: r.ref, mode: r.mode, at: new Date(r.created_at).getTime()
      }));

      const prayerRows = must(prayers) as { id: string; who: string; meta: string; body: string; status: string; praying: number; answered: boolean; created_at: string }[];
      let mine = new Set<string>();
      if (membership.membershipId) {
        const p = await db.from('prayer_praying').select('request_id').eq('membership_id', membership.membershipId);
        mine = new Set(((p.data ?? []) as { request_id: string }[]).map((r) => r.request_id));
      }
      d.prayers = prayerRows
        .filter((p) => p.status === 'wall')
        .map((p) => ({ id: p.id, who: p.who, meta: p.meta, body: p.body, praying: p.praying, prayed: mine.has(p.id), answered: p.answered, at: new Date(p.created_at).getTime() }));
      d.prayerQueue = prayerRows
        .filter((p) => p.status === 'queued')
        .map((p) => ({ id: p.id, who: p.who, meta: p.meta, body: p.body, at: new Date(p.created_at).getTime() }));

      d.careReminders = ((care.data ?? []) as { id: string; name: string; meta: string; flagged_by: string; kind: 'followup' | 'note'; body: string; created_at: string }[]).map((c) => ({
        id: c.id,
        kind: c.kind,
        body: c.body,
        name: c.name,
        initials: c.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
        meta: c.meta,
        flaggedBy: c.flagged_by,
        at: new Date(c.created_at).getTime()
      }));
      d.events = ((events.data ?? []) as { id: string; title: string; meta: string; date_label: string; color: string; audiences: string[]; day: string | null; time_label: string; place: string; status: 'proposed' | 'approved'; proposed_by: string; rsvp_closed: boolean }[]).map(
        (e): MinistryEvent => ({
          id: e.id, title: e.title, meta: e.meta, date: e.date_label, color: e.color, roles: (e.audiences.length ? e.audiences : [...ALL_AUDIENCES]) as MinistryEvent['roles'],
          iso: e.day, time: e.time_label, place: e.place, status: e.status, by: e.proposed_by, rsvpClosed: e.rsvp_closed
        })
      );
      d.challenges = ((challenges.data ?? []) as { id: string; kind: 'Team' | 'Individual'; title: string; body: string; points_label: string; status: string; done: boolean; team_id: string | null; category_key: string | null; amount: number | null }[]).map((c) => ({
        id: c.id, kind: c.kind, title: c.title, body: c.body, pointsLabel: c.points_label, status: c.status, done: c.done,
        team: c.team_id ?? undefined, cat: c.category_key ?? undefined, amount: c.amount ?? undefined
      }));
      d.accessRequests = ((access.data ?? []) as { id: string; name: string; email: string; person_type: string; household: string; meta: string; requested_role: AccessRequest['requestedRole']; flagged: boolean; note: string; created_at: string }[]).map((r) => ({
        id: r.id, name: r.name, email: r.email, personType: r.person_type, household: r.household || 'No household on file', meta: r.meta,
        requestedRole: r.requested_role, flagged: r.flagged, note: r.note, at: new Date(r.created_at).getTime(), status: 'pending'
      }));
      d.activityLog = ((log.data ?? []) as { id: string; line: string; created_at: string }[]).map((l) => ({ id: l.id, line: l.line, at: new Date(l.created_at).getTime() }));

      for (const doc of (docs.data ?? []) as { key: string; value: unknown }[]) {
        if (doc.key in d) (d as unknown as Record<string, unknown>)[doc.key] = doc.value;
      }

      /* Tonight: attendance and the shared run sheet. */
      d.tonight.date = tonight;
      const [att, night, season] = await Promise.all([
        db.from('attendance').select('student_id, present, via').eq('org_id', org).eq('meeting_date', tonight),
        db.from('nights').select('huddle, game').eq('org_id', org).eq('meeting_date', tonight).maybeSingle(),
        config.meetingDates.length
          ? db.from('attendance').select('student_id, meeting_date').eq('org_id', org).eq('present', true).in('meeting_date', config.meetingDates).limit(50000)
          : Promise.resolve({ data: [] as { student_id: string; meeting_date: string }[] })
      ]);
      /* The attendance map: percent of each roster present, week by week. */
      const teamOfStudent = new Map(studentRows.map((s) => [s.id, s.team_id]));
      const rosterSize = new Map<string, number>();
      for (const s of studentRows) if (s.team_id) rosterSize.set(s.team_id, (rosterSize.get(s.team_id) ?? 0) + 1);
      const hits = new Map<string, number>();
      for (const a of (season.data ?? []) as { student_id: string; meeting_date: string }[]) {
        const team = teamOfStudent.get(a.student_id);
        if (team) hits.set(team + '|' + a.meeting_date, (hits.get(team + '|' + a.meeting_date) ?? 0) + 1);
      }
      for (const t of d.teams) {
        const n = rosterSize.get(t.id) ?? 0;
        d.attendanceHistory[t.id] = config.meetingDates.map((iso) => (n ? Math.round(((hits.get(t.id + '|' + iso) ?? 0) / n) * 100) : 0));
      }
      /* Badges: an attendance streak (consecutive meeting nights present, up
         to tonight) next to a Bible streak (consecutive days practiced). */
      const presentOn = new Map<string, Set<string>>();
      for (const r of (season.data ?? []) as { student_id: string; meeting_date: string }[]) {
        (presentOn.get(r.student_id) ?? presentOn.set(r.student_id, new Set()).get(r.student_id)!).add(r.meeting_date);
      }
      const past = config.meetingDates.filter((iso) => iso <= tonight).reverse();
      d.studentBadges = studentRows
        .map((st) => {
          const seen = presentOn.get(st.id) ?? new Set<string>();
          let attend = 0;
          for (const iso of past) {
            if (!seen.has(iso)) break;
            attend++;
          }
          const bible = bibleStats(d.practiceLog.filter((r) => r.who === st.name), config.memoryVerses, config.weekNumber).streak;
          return { name: st.name, team: st.team_id ?? '', attendStreak: attend, bibleStreak: bible };
        })
        .filter((b) => b.attendStreak || b.bibleStreak);
      const byId = new Map(studentRows.map((s) => [s.id, s.name]));
      for (const a of (att.data ?? []) as { student_id: string; present: boolean; via: 'qr' | 'leader' | null }[]) {
        const name = byId.get(a.student_id);
        if (name && a.present) {
          d.tonight.presence[name] = true;
          d.tonight.via[name] = a.via ?? 'leader';
        }
      }
      /* Who came each past night — the recap's "usually here". */
      for (const a of (season.data ?? []) as { student_id: string; meeting_date: string }[]) {
        const name = byId.get(a.student_id);
        if (name && a.meeting_date < tonight) (d.presenceLog[a.meeting_date] ??= []).push(name);
      }
      const nightRow = night.data as { huddle: Partial<MinistryData['huddle']>; game: Partial<MinistryData['game']> } | null;
      const h = nightRow?.huddle;
      if (h && Object.keys(h).length) d.huddle = { ...d.huddle, ...h };
      const g = nightRow?.game;
      if (g && Object.keys(g).length) d.game = { ...d.game, ...g };

      /* RSVPs (yours, or everyone's for the volunteer set) and head counts. */
      const [rs, counts, chat] = await Promise.all([
        db.from('rsvps').select('event_id, name, status, guests').eq('org_id', org),
        db.rpc('rsvp_counts', { p_org: org }),
        db.from('chat_messages').select('*').eq('org_id', org).order('created_at', { ascending: false }).limit(400)
      ]);
      for (const r of (rs.data ?? []) as { event_id: string; name: string; status: Rsvp['status']; guests: number }[]) {
        (d.rsvps[r.event_id] ??= {})[r.name] = { status: r.status, guests: r.guests };
      }
      d.rsvpCounts = countsFrom(counts.data);

      /* The people list, for leaders (members_read_leader). */
      if (membership.role === 'leader' || membership.role === 'owner') {
        const ppl = await db.from('memberships').select('id, role, display_name, team_id, student_name').eq('org_id', org).order('display_name');
        d.people = ((ppl.data ?? []) as { id: string; role: PersonRow['role']; display_name: string; team_id: string | null; student_name: string | null }[]).map((r) => ({
          id: r.id, name: r.display_name, role: r.role, teamId: r.team_id, studentName: r.student_name
        }));
      }

      /* The library: everything shared by any ministry, plus our own. */
      const lib = await db.from('library_units').select('*').order('created_at', { ascending: false }).limit(300);
      d.library = ((lib.data ?? []) as { id: string; org_id: string; kind: string; title: string; church_name: string; span: string; theme: string; summary: string; includes: string[]; pts: [string, number][]; created_at: string }[]).map((u) => ({
        id: u.id, kind: u.kind, title: u.title, church: u.org_id === org ? null : u.church_name || 'Another ministry', span: u.span, theme: u.theme, summary: u.summary, includes: u.includes ?? [], pts: u.pts ?? [],
        used: u.org_id === org ? 'Shared by you' : 'Shared ' + new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      }));

      /* Awards: my votes, the tally (leaders), and nominations anyone added. */
      const [votes, noms] = await Promise.all([
        db.from('award_votes').select('award_id, period, membership_id, choice').eq('org_id', org),
        db.from('award_nominees').select('id, award_id, name').eq('org_id', org).order('created_at')
      ]);
      const tallies: Record<string, Record<string, number>> = {};
      for (const v of (votes.data ?? []) as { award_id: string; period: string; membership_id: string; choice: string }[]) {
        if (v.membership_id === membership.membershipId) (d.awardVotes[v.award_id] ??= {})[v.period] = v.choice;
        const a = d.awards.find((x) => x.id === v.award_id);
        if (a && v.period === periodKey(a.voteFrequency)) (tallies[v.award_id] ??= {})[v.choice] = (tallies[v.award_id]?.[v.choice] ?? 0) + 1;
      }
      d.awardTallies = tallies;
      for (const n of (noms.data ?? []) as { id: string; award_id: string; name: string }[]) {
        const a = d.awards.find((x) => x.id === n.award_id);
        if (a && !(a.nominees ?? []).some((x) => x.id === n.id)) a.nominees = [...(a.nominees ?? []), { id: n.id, name: n.name }];
      }

      /* Chat: the announcement thread, the volunteer thread, and one thread per
         squad — RLS (chat_can) decides which of them return any rows. */
      d.chatThreads = chatThreads(d.teams, d.roster.length, membership);
      for (const row of ((chat.data ?? []) as ChatRow[]).reverse()) (d.chatMsgs[row.thread_id] ??= []).push(toChat(row, membership.membershipId));

      /* The week around the night. Each read returns only what this role may
         see (RLS), so a student's load simply comes back empty here. */
      const recent = config.meetingDates.filter((x) => x <= tonight).slice(-4);
      const ahead = [tonight, ...config.meetingDates.filter((x) => x > tonight)].slice(0, 8);
      const nightsIn = [...new Set([...recent, ...ahead])];
      const [rem, fu, notes, pick, flags, sched, avail, swaps, invites, fams, slips, sigs, pmsgs, preads] = await Promise.all([
        db.from('night_reminders').select('*').eq('org_id', org).in('meeting_date', nightsIn),
        db.from('night_followups').select('*').eq('org_id', org).in('meeting_date', nightsIn),
        db.from('night_notes').select('*').eq('org_id', org).in('meeting_date', nightsIn),
        db.from('night_pickup').select('*').eq('org_id', org).in('meeting_date', nightsIn),
        db.from('door_flags').select('*').eq('org_id', org).in('meeting_date', nightsIn),
        db.from('serve_schedule').select('*').eq('org_id', org).gte('meeting_date', tonight),
        db.from('serve_availability').select('*').eq('org_id', org).gte('meeting_date', tonight),
        db.from('serve_swaps').select('*').eq('org_id', org).order('created_at', { ascending: false }).limit(100),
        db.from('volunteer_invites').select('*').eq('org_id', org).order('created_at', { ascending: false }),
        db.from('families').select('*').eq('org_id', org),
        db.from('permission_slips').select('*').eq('org_id', org).order('created_at', { ascending: false }),
        db.from('slip_signatures').select('*').eq('org_id', org),
        db.from('parent_messages').select('*').eq('org_id', org).order('created_at', { ascending: false }).limit(60),
        db.from('parent_message_reads').select('message_id, student_id, read_at')
      ]);
      const nightOf = (iso: string) => (d.cycle[iso] ??= { rem: {}, fu: {}, notes: { well: '', change: '' }, pickupShift: 0, doorFlags: [] });
      const ms = (t: string | null) => (t ? new Date(t).getTime() : 0);
      for (const r of (rem.data ?? []) as { meeting_date: string; reminder_id: string; off: boolean; sent_at: string | null; body: string | null }[])
        nightOf(r.meeting_date).rem[r.reminder_id] = { off: r.off, ...(r.sent_at ? { sentAt: ms(r.sent_at) } : {}), ...(r.body ? { text: r.body } : {}) };
      for (const r of (fu.data ?? []) as { meeting_date: string; item_id: string; done: boolean; done_at: string | null; body: string | null; done_by: string }[])
        nightOf(r.meeting_date).fu[r.item_id] = { done: r.done, at: ms(r.done_at), by: r.done_by, ...(r.body ? { text: r.body } : {}) };
      for (const r of (notes.data ?? []) as { meeting_date: string; went_well: string; change_next: string }[]) nightOf(r.meeting_date).notes = { well: r.went_well, change: r.change_next };
      for (const r of (pick.data ?? []) as { meeting_date: string; shift_min: number }[]) nightOf(r.meeting_date).pickupShift = r.shift_min;
      for (const r of (flags.data ?? []) as { id: string; meeting_date: string; name: string; done: boolean; created_at: string }[])
        nightOf(r.meeting_date).doorFlags.push({ id: r.id, name: r.name, at: ms(r.created_at), done: r.done });
      for (const r of (sched.data ?? []) as { meeting_date: string; role: string; name: string | null }[]) d.serving.sched[r.meeting_date + '|' + r.role] = r.name;
      for (const r of (avail.data ?? []) as { name: string; meeting_date: string; state: 'yes' | 'no' }[]) d.serving.avail[r.name + '|' + r.meeting_date] = r.state;
      d.serving.swaps = ((swaps.data ?? []) as { id: string; from_name: string; meeting_date: string; role: string; to_name: string | null; why: string; status: 'pending' | 'approved' | 'declined'; decided_by: string | null; created_at: string }[]).map((r) => ({
        id: r.id, from: r.from_name, night: r.meeting_date, role: r.role, to: r.to_name, why: r.why, status: r.status, at: ms(r.created_at), ...(r.decided_by ? { decidedBy: r.decided_by } : {})
      }));
      d.serving.invites = ((invites.data ?? []) as { id: string; name: string; contact: string; role: string; status: 'sent' | 'accepted'; created_at: string }[]).map((r) => ({ id: r.id, name: r.name, contact: r.contact, role: r.role, status: r.status, at: ms(r.created_at) }));
      for (const r of (fams.data ?? []) as { student_id: string; guardian: string; contact: string; token: string }[]) {
        const name = byId.get(r.student_id);
        if (name) d.families[name] = { guardian: r.guardian, contact: r.contact, token: r.token };
      }
      d.slips = ((slips.data ?? []) as { id: string; title: string; due: string; kids: string[] | null; created_at: string }[]).map((r) => ({ id: r.id, title: r.title, due: r.due, kids: r.kids ?? 'all', at: ms(r.created_at) }));
      for (const r of (sigs.data ?? []) as { slip_id: string; student_id: string; signed_by: string; signed_at: string }[]) {
        const name = byId.get(r.student_id);
        if (name) d.slipSigned[r.slip_id + '|' + name] = { by: r.signed_by, at: ms(r.signed_at) };
      }
      const reads = new Map<string, Record<string, number>>();
      for (const r of (preads.data ?? []) as { message_id: string; student_id: string; read_at: string }[]) {
        const name = byId.get(r.student_id);
        if (name) (reads.get(r.message_id) ?? reads.set(r.message_id, {}).get(r.message_id)!)[name] = ms(r.read_at);
      }
      d.parentMsgs = ((pmsgs.data ?? []) as { id: string; from_name: string; audience: string; kids: string[]; body: string; created_at: string }[]).map((r) => ({
        id: r.id, from: r.from_name, to: r.audience, kids: r.kids ?? [], text: r.body, at: ms(r.created_at), reads: reads.get(r.id) ?? {}
      }));
      return d;
    },

    saveSnapshot() {
      /* Each change syncs on its own in this mode. */
    },

    async pushEntries(list) {
      if (!list.length) return;
      const rows = list.map((e) => ({
        id: e.id,
        org_id: org,
        team_id: e.team,
        category_key: e.cat,
        amount: e.amount,
        reason: e.why,
        student_name: e.student ?? null,
        detail: e.detail ?? null,
        batch_id: e.batch ?? null,
        reverses: e.reverses ?? null,
        entered_by_name: e.by,
        created_at: new Date(e.at).toISOString()
      }));
      /* ON CONFLICT (id) DO NOTHING — a replay is a no-op, never a double post. */
      const res = await db.from('score_entries').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
      if (res.error) throw new Error(res.error.message);
    },

    async decideEntries(ids, status, by) {
      const res = await db
        .from('score_entries')
        .update({ status, decided_by_name: by, decided_at: new Date().toISOString() })
        .in('id', ids)
        .eq('status', 'pending');
      if (res.error) throw new Error(res.error.message);
    },

    /* Writes apply in the order they were made: adding a visitor, then their
       family, then their check-in each need the row before. */
    sync(e: SyncEvent) {
      const run = queue.then(() => apply(e));
      queue = run.catch(() => undefined);
      return run;
    },

    async fileUrl(path: string) {
      const r = await db.storage.from('media').createSignedUrl(path, 60 * 60);
      return r.data?.signedUrl ?? null;
    },

    subscribe(onRemote: (p: RemotePatch) => void) {
      const ch = db
        .channel('org-' + org)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'score_entries', filter: 'org_id=eq.' + org }, (payload: { new: unknown }) => {
          const row = payload.new as EntryRow | undefined;
          if (row && row.id) onRemote({ kind: 'entries', entries: [toEntry(row)] });
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'org_id=eq.' + org }, (payload: { new: unknown }) => {
          const row = payload.new as ChatRow | undefined;
          if (row?.id) onRemote({ kind: 'chat', threadId: row.thread_id, msg: toChat(row, membership.membershipId) });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rsvps', filter: 'org_id=eq.' + org }, (payload: { new: unknown }) => {
          const row = payload.new as { event_id?: string; name?: string; status?: Rsvp['status']; guests?: number } | undefined;
          if (!row?.event_id || !row.name || !row.status) return;
          const rec: Rsvp = { status: row.status, guests: row.guests ?? 0 };
          void db.rpc('rsvp_counts', { p_org: org }).then((c: { data: unknown }) => onRemote({ kind: 'rsvp', eventId: row.event_id!, name: row.name!, rec, counts: countsFrom(c.data) }));
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'nights', filter: 'org_id=eq.' + org }, (payload: { new: unknown }) => {
          const row = payload.new as { meeting_date?: string; huddle?: MinistryData['huddle']; game?: MinistryData['game'] } | undefined;
          if (!row || row.meeting_date !== tonight) return;
          if (row.huddle && Object.keys(row.huddle).length) onRemote({ kind: 'huddle', huddle: row.huddle });
          if (row.game && Object.keys(row.game).length) onRemote({ kind: 'game', game: row.game });
        })
        .subscribe();
      return () => {
        void db.removeChannel(ch);
      };
    }
  };
  return backend;
}

/** Leader-curated documents that live in ministry_docs, by MinistryData key. */
export const DOC_KEYS = ['smallGroups', 'awards', 'visitorLog', 'verseLog', 'libraryPlaced'] as const;
