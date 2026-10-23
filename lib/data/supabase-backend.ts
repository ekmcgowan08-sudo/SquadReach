'use client';
/* SUPABASE MODE — the ministry lives in the database. Each change is written
   as it happens; row-level security (supabase/migrations) decides what any
   role can read or write, from the same constants the UI reads.

   Score entries are the exception to "write as it happens": they go through
   the outbox, and pushEntries() is idempotent on the client-generated id, so
   a replay over a flaky connection can never double-post. */
import type { Backend, RemotePatch, SyncEvent } from '@/lib/data/backend';
import { DEFAULT_CONFIG, emptyMinistry } from '@/lib/data/empty';
import { isoDay, tonightDate, weekOf } from '@/lib/dates';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { ScoreEntryStatus } from '@/lib/types/domain';
import type {
  AccessRequest, Category, LedgerEntry, Membership, MinistryConfig, MinistryData, MinistryEvent, Student, Team
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

export function supabaseBackend(membership: Membership): Backend {
  const db = supabaseBrowser();
  const org = membership.orgId!;
  /* name ↔ id for the roster: the app finds students by name on the floor. */
  let studentIds = new Map<string, string>();
  let tonight = '';

  const must = <T,>(res: { data: T | null; error: { message: string } | null }): T => {
    if (res.error) throw new Error(res.error.message);
    return res.data as T;
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
      d.events = ((events.data ?? []) as { id: string; title: string; meta: string; date_label: string; color: string; audiences: string[] }[]).map(
        (e): MinistryEvent => ({ id: e.id, title: e.title, meta: e.meta, date: e.date_label, color: e.color, roles: (e.audiences.length ? e.audiences : [...ALL_AUDIENCES]) as MinistryEvent['roles'] })
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
        db.from('attendance').select('student_id, present').eq('org_id', org).eq('meeting_date', tonight),
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
      const byId = new Map(studentRows.map((s) => [s.id, s.name]));
      for (const a of (att.data ?? []) as { student_id: string; present: boolean }[]) {
        const name = byId.get(a.student_id);
        if (name && a.present) d.tonight.presence[name] = true;
      }
      const nightRow = night.data as { huddle: Partial<MinistryData['huddle']>; game: Partial<MinistryData['game']> } | null;
      const h = nightRow?.huddle;
      if (h && Object.keys(h).length) d.huddle = { ...d.huddle, ...h };
      const g = nightRow?.game;
      if (g && Object.keys(g).length) d.game = { ...d.game, ...g };
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

    async sync(e: SyncEvent) {
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
          const sid = studentIds.get(e.student);
          if (!sid) return;
          await db.from('attendance').upsert({ org_id: org, meeting_date: e.date || tonight, student_id: sid, present: e.present, marked_by: membership.membershipId, updated_at: new Date().toISOString() });
          return;
        }
        case 'chat':
        case 'rsvp':
          /* Chat and RSVPs run on this device in this release. */
          return;
        case 'practice':
          if (!membership.membershipId) return;
          await db.from('practice_log').upsert(
            { id: e.row.id, org_id: org, membership_id: membership.membershipId, who: e.row.who, team_id: e.row.team, day: e.row.day, ref: e.row.ref, mode: e.row.mode },
            { onConflict: 'membership_id,day', ignoreDuplicates: true }
          );
          return;
      }
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
export const DOC_KEYS = ['smallGroups', 'awards', 'visitorLog', 'verseLog'] as const;
