-- ─────────────────────────────────────────────────────────────────────────
-- SquadRise — schema, row-level security and the rules the UI relies on.
--
-- The five permission arrays in lib/types/domain.ts are mirrored here as
-- has_role() calls. Change one, change both:
--   LEADER_ROLES        {leader, owner}
--   ROSTER_EDIT_ROLES   {coach, leader, owner}
--   SCORE_ENTRY_ROLES   {coach, scorekeeper, leader, owner}
--   AUTO_APPROVE_ROLES  {scorekeeper, leader, owner}
--   EVENT_CONTROL_ROLES {scorekeeper, leader, owner}
--   SHEET_ROLES         EVENT_CONTROL_ROLES + coach
--
-- Parent and Congregation are a design PROPOSAL and deliberately absent from
-- membership_role. Adding them is a migration plus an RLS review.
-- ─────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

create type public.membership_role as enum ('member', 'captain', 'coach', 'scorekeeper', 'leader', 'owner');
create type public.score_entry_status as enum ('pending', 'approved', 'rejected');
create type public.prayer_status as enum ('queued', 'held', 'wall');
create type public.access_status as enum ('pending', 'approved', 'denied');

-- ── organizations ────────────────────────────────────────────────────────
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  -- Everything the pastor edits in Setup: point base, weekly growth, goal
  -- value, verse board, meeting dates, church card. Shape: MinistryConfig.
  config jsonb not null default '{}'::jsonb,
  -- Shared with families and volunteers to ask for access. Rotatable.
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_at timestamptz not null default now()
);

-- ── squads, categories, roster ───────────────────────────────────────────
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text not null default '#968ae0',
  mascot_name text not null default '',
  mascot_story text not null default '',
  sort int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.teams (org_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  label text not null,
  color text not null default '#968ae0',
  icon text not null default 'ph ph-tag',
  hint text not null default '',
  sort int not null default 0,
  archived boolean not null default false,
  unique (org_id, key)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  name text not null,
  grade text not null default '',
  captain boolean not null default false,
  guest boolean not null default false,
  new_in_db boolean not null default false,
  created_at timestamptz not null default now(),
  -- Names are how a coach finds a student on the floor; keep them unique.
  unique (org_id, name)
);
create index on public.students (org_id, team_id);

-- ── memberships ──────────────────────────────────────────────────────────
-- One row per role a person holds. "Every account can hold several roles";
-- the app picks which one you are using, RLS grants the union.
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.membership_role not null,
  display_name text not null default '',
  team_id uuid references public.teams(id) on delete set null,
  student_name text,
  created_at timestamptz not null default now(),
  unique (org_id, user_id, role)
);
create index on public.memberships (user_id);

-- ── role helpers (SECURITY DEFINER so policies on memberships don't recurse)
create or replace function public.has_role(org uuid, roles public.membership_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = org and m.user_id = auth.uid() and m.role = any (roles)
  );
$$;

create or replace function public.is_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m where m.org_id = org and m.user_id = auth.uid());
$$;

create or replace function public.my_membership(org uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select m.id from public.memberships m
  where m.org_id = org and m.user_id = auth.uid()
  order by array_position(array['owner','leader','scorekeeper','coach','captain','member']::public.membership_role[], m.role)
  limit 1;
$$;

-- Chat visibility, in one place. 'all' is the announcement thread: everyone
-- reads, the volunteer set posts. 'leaders' is the volunteer set. A squad thread
-- is that squad's members plus the volunteer set.
create or replace function public.chat_can(org uuid, thread text, posting boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when thread = 'all' then
      case when posting then public.has_role(org, array['coach','scorekeeper','leader','owner']::public.membership_role[]) else public.is_member(org) end
    when thread = 'leaders' then public.has_role(org, array['coach','scorekeeper','leader','owner']::public.membership_role[])
    when thread like 'team-%' then
      public.has_role(org, array['coach','scorekeeper','leader','owner']::public.membership_role[])
      or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id = org and m.team_id::text = substr(thread, 6))
    else false
  end;
$$;

-- ── the ledger ───────────────────────────────────────────────────────────
-- Append-only. Nothing edits or deletes a past entry: an undo writes its
-- opposite, and both stay. `id` is generated ON THE PHONE and is the
-- idempotency key: an outbox replayed over a flaky connection inserts with
-- ON CONFLICT DO NOTHING, so it can never double-post.
create table public.score_entries (
  id uuid primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.teams(id),
  category_key text not null,
  amount int not null,
  reason text not null default '',
  student_name text,
  -- The detail, not just the total: count, articles, verses, proof, place.
  -- Without it a corrected entry cannot be recomputed nor reports rebuilt.
  detail jsonb,
  batch_id uuid,
  reverses uuid references public.score_entries(id),
  status public.score_entry_status not null default 'pending',
  entered_by uuid references public.memberships(id) on delete set null,
  entered_by_name text not null default '',
  -- Client time of the tap. Replay order for the audit log comes from here,
  -- not from now().
  created_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  decided_by_name text,
  decided_at timestamptz
);
create index on public.score_entries (org_id, created_at desc);
create index on public.score_entries (org_id, status);

-- Approval routing, decided by the database from the REAL role. The client
-- sends a status; it is ignored. Queueing never launders a role: a coach's
-- entries land pending whether they were tapped online or replayed.
create or replace function public.score_entries_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.entered_by := public.my_membership(new.org_id);
  new.received_at := now();
  -- A phone clock can be wrong; never let one stamp an entry into the future.
  if new.created_at > now() + interval '5 minutes' then new.created_at := now(); end if;
  new.status := case
    when public.has_role(new.org_id, array['scorekeeper','leader','owner']::public.membership_role[]) then 'approved'
    else 'pending' end;
  new.decided_by_name := null;
  new.decided_at := null;
  return new;
end $$;
create trigger score_entries_before_insert before insert on public.score_entries
  for each row execute function public.score_entries_before_insert();

-- Only the decision columns may change, and only pending → decided.
create or replace function public.score_entries_before_update()
returns trigger language plpgsql as $$
begin
  if (new.id, new.org_id, new.team_id, new.category_key, new.amount, new.reason, new.student_name,
      new.detail, new.batch_id, new.reverses, new.entered_by, new.entered_by_name, new.created_at)
     is distinct from
     (old.id, old.org_id, old.team_id, old.category_key, old.amount, old.reason, old.student_name,
      old.detail, old.batch_id, old.reverses, old.entered_by, old.entered_by_name, old.created_at) then
    raise exception 'score_entries is append-only: only the decision may change';
  end if;
  if old.status <> 'pending' and new.status <> old.status then
    raise exception 'entry % is already %', old.id, old.status;
  end if;
  if new.status <> old.status then new.decided_at := coalesce(new.decided_at, now()); end if;
  return new;
end $$;
create trigger score_entries_before_update before update on public.score_entries
  for each row execute function public.score_entries_before_update();

-- ── tonight: attendance ──────────────────────────────────────────────────
create table public.attendance (
  org_id uuid not null references public.organizations(id) on delete cascade,
  meeting_date date not null,
  student_id uuid not null references public.students(id) on delete cascade,
  present boolean not null default true,
  marked_by uuid references public.memberships(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (org_id, meeting_date, student_id)
);

-- ── the night: run sheet, crew, debrief ──────────────────────────────────
-- runIdx is shared state for the whole building — the holder taps, every
-- other phone follows over realtime. Stored whole for this release.
create table public.nights (
  org_id uuid not null references public.organizations(id) on delete cascade,
  meeting_date date not null,
  huddle jsonb not null default '{}'::jsonb,
  -- the game timer: banked time + start stamps, so the projector follows
  game jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (org_id, meeting_date)
);

-- ── discipleship ─────────────────────────────────────────────────────────
-- A request goes to the leader review queue and never straight to the wall.
create table public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  author uuid references public.memberships(id) on delete set null,
  who text not null,
  meta text not null default '',
  body text not null check (length(trim(body)) >= 12),
  status public.prayer_status not null default 'queued',
  praying int not null default 0,
  answered boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.prayer_praying (
  request_id uuid not null references public.prayer_requests(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  primary key (request_id, membership_id)
);

-- Team care is ROSTER_EDIT_ROLES only. Scorekeeper owns the ledger, not people.
create table public.care_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  meta text not null default '',
  flagged_by text not null default '',
  kind text not null default 'followup' check (kind in ('followup', 'note')),
  body text not null default '',
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── calendar, pushes, access ─────────────────────────────────────────────
create table public.events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  meta text not null default '',
  date_label text not null default '',
  color text not null default '#968ae0',
  audiences text[] not null default array['members','captains','coaches','scorekeeper','leaders','parents','admins'],
  day date,
  time_label text not null default '',
  place text not null default '',
  -- coaches, captains and scorekeepers propose; LEADER_ROLES approve
  status text not null default 'approved' check (status in ('proposed', 'approved')),
  proposed_by text not null default '',
  rsvp_closed boolean not null default false,
  created_at timestamptz not null default now()
);

-- One answer per person per event. Counts are public to the ministry
-- (rsvp_counts); names only to the volunteer set.
create table public.rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  name text not null,
  status text not null check (status in ('going', 'maybe', 'out')),
  guests int not null default 0 check (guests between 0 and 20),
  updated_at timestamptz not null default now(),
  primary key (event_id, membership_id)
);

-- Chat. Thread ids are 'all' (announcements), 'leaders', 'team-<team uuid>'.
-- Who may read or post is decided in one function, chat_can().
create table public.chat_messages (
  id uuid primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  thread_id text not null,
  author uuid references public.memberships(id) on delete set null,
  author_name text not null default '',
  role_label text not null default '',
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on public.chat_messages (org_id, thread_id, created_at desc);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null default 'Team' check (kind in ('Team', 'Individual')),
  title text not null,
  body text not null default '',
  points_label text not null default '',
  status text not null default '',
  done boolean not null default false,
  team_id uuid references public.teams(id) on delete set null,
  category_key text,
  amount int,
  created_at timestamptz not null default now()
);

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null default '',
  person_type text not null default '',
  household text not null default '',
  meta text not null default '',
  requested_role public.membership_role not null,
  flagged boolean not null default false,
  note text not null default '',
  status public.access_status not null default 'pending',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor uuid references public.memberships(id) on delete set null,
  line text not null,
  created_at timestamptz not null default now()
);
create index on public.activity_log (org_id, created_at desc);

-- Bible practice: that someone did the work, never how well. One row per
-- person per day keeps the streak honest across phones.
create table public.practice_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  who text not null,
  team_id uuid references public.teams(id) on delete set null,
  day date not null,
  ref text not null,
  mode text not null default '',
  created_at timestamptz not null default now(),
  unique (membership_id, day)
);
create index on public.practice_log (org_id, day desc);

-- The week albums. Files live in the private 'media' storage bucket under
-- <org>/<week>/<id>; this row is what the album lists.
create table public.media_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  week int not null,
  kind text not null check (kind in ('photo', 'video', 'audio')),
  label text not null default '',
  path text,
  created_by uuid references public.memberships(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index on public.media_items (org_id, week);

-- Awards. The awards themselves are a curated document (ministry_docs
-- 'awards'); votes and nominations are rows so anyone can add their own.
-- period is 'season', a day (YYYY-MM-DD) or a week (YYYY-Www).
create table public.award_votes (
  org_id uuid not null references public.organizations(id) on delete cascade,
  award_id text not null,
  period text not null,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  choice text not null,
  created_at timestamptz not null default now(),
  primary key (org_id, award_id, period, membership_id)
);
create table public.award_nominees (
  id uuid primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  award_id text not null,
  name text not null check (length(name) between 1 and 80),
  nominated_by uuid references public.memberships(id) on delete set null,
  created_at timestamptz not null default now()
);

-- The library. Units a ministry publishes for others to lift into their own
-- season: content and suggested point values only — there is no column a
-- student's name could go in. Shared units are readable by anyone signed in.
create table public.library_units (
  id uuid primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('week', 'lesson', 'game', 'guide', 'series', 'event', 'season')),
  title text not null,
  church_name text not null default '',
  span text not null default '',
  theme text not null default '',
  summary text not null default '',
  includes text[] not null default '{}',
  pts jsonb not null default '[]'::jsonb,
  shared boolean not null default true,
  created_at timestamptz not null default now()
);

-- The long tail a leader curates — small-group guides, award races, media
-- album metadata, saved reports. One document per key per ministry.
-- Nothing about students is written here by students.
create table public.ministry_docs (
  org_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (org_id, key)
);

-- ─────────────────────────────────────────────────────────────────────────
-- ROW-LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────
alter table public.organizations enable row level security;
alter table public.teams enable row level security;
alter table public.categories enable row level security;
alter table public.students enable row level security;
alter table public.memberships enable row level security;
alter table public.score_entries enable row level security;
alter table public.attendance enable row level security;
alter table public.nights enable row level security;
alter table public.prayer_requests enable row level security;
alter table public.prayer_praying enable row level security;
alter table public.care_notes enable row level security;
alter table public.events enable row level security;
alter table public.challenges enable row level security;
alter table public.access_requests enable row level security;
alter table public.activity_log enable row level security;
alter table public.ministry_docs enable row level security;
alter table public.practice_log enable row level security;
alter table public.media_items enable row level security;
alter table public.rsvps enable row level security;
alter table public.chat_messages enable row level security;
alter table public.award_votes enable row level security;
alter table public.library_units enable row level security;
alter table public.award_nominees enable row level security;

-- organizations: members read; LEADER_ROLES edit the setup.
create policy org_read on public.organizations for select using (public.is_member(id));
create policy org_edit on public.organizations for update
  using (public.has_role(id, array['leader','owner']::public.membership_role[]))
  with check (public.has_role(id, array['leader','owner']::public.membership_role[]));

-- squads and categories: members read; LEADER_ROLES write.
create policy teams_read on public.teams for select using (public.is_member(org_id));
create policy teams_write on public.teams for all
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['leader','owner']::public.membership_role[]));
create policy cats_read on public.categories for select using (public.is_member(org_id));
create policy cats_write on public.categories for all
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['leader','owner']::public.membership_role[]));

-- roster: members read; ROSTER_EDIT_ROLES add and edit (a coach adds a
-- student from the floor). Deleting a student is a leader decision.
create policy students_read on public.students for select using (public.is_member(org_id));
create policy students_insert on public.students for insert
  with check (public.has_role(org_id, array['coach','leader','owner']::public.membership_role[]));
create policy students_update on public.students for update
  using (public.has_role(org_id, array['coach','leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['coach','leader','owner']::public.membership_role[]));
create policy students_delete on public.students for delete
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]));

-- memberships: you read your own; leaders read and manage the ministry's.
create policy members_read_own on public.memberships for select using (user_id = auth.uid());
create policy members_read_leader on public.memberships for select
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]));
create policy members_manage on public.memberships for all
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['leader','owner']::public.membership_role[]));

-- the ledger: members read; SCORE_ENTRY_ROLES (and a captain's submission)
-- insert — the trigger decides the status; only LEADER_ROLES decide, and an
-- author may withdraw their own entry while it is still pending.
create policy entries_read on public.score_entries for select using (public.is_member(org_id));
create policy entries_insert on public.score_entries for insert
  with check (public.has_role(org_id, array['coach','scorekeeper','leader','owner','captain']::public.membership_role[]));
create policy entries_decide on public.score_entries for update
  using (
    public.has_role(org_id, array['leader','owner']::public.membership_role[])
    or (status = 'pending' and entered_by in (select m.id from public.memberships m where m.user_id = auth.uid()))
  )
  with check (
    public.has_role(org_id, array['leader','owner']::public.membership_role[])
    or (status = 'rejected' and entered_by in (select m.id from public.memberships m where m.user_id = auth.uid()))
  );

-- attendance is roster data: ROSTER_EDIT_ROLES write, members read.
create policy attendance_read on public.attendance for select using (public.is_member(org_id));
create policy attendance_write on public.attendance for all
  using (public.has_role(org_id, array['coach','leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['coach','leader','owner']::public.membership_role[]));

-- the night: the volunteer set reads (SCORE_ENTRY_ROLES); SHEET_ROLES move it.
create policy nights_read on public.nights for select
  using (public.has_role(org_id, array['coach','scorekeeper','leader','owner']::public.membership_role[]));
create policy nights_write on public.nights for all
  using (public.has_role(org_id, array['coach','scorekeeper','leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['coach','scorekeeper','leader','owner']::public.membership_role[]));

-- prayer: anyone in the ministry may file a request (it lands queued);
-- everyone reads the wall; LEADER_ROLES read the queue and post or hold.
create policy prayer_read_wall on public.prayer_requests for select
  using (public.is_member(org_id) and status = 'wall');
create policy prayer_read_queue on public.prayer_requests for select
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]));
create policy prayer_read_own on public.prayer_requests for select
  using (author in (select m.id from public.memberships m where m.user_id = auth.uid()));
create policy prayer_file on public.prayer_requests for insert
  with check (public.is_member(org_id) and status = 'queued' and praying = 0 and answered = false);
create policy prayer_decide on public.prayer_requests for update
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['leader','owner']::public.membership_role[]));
create policy praying_read on public.prayer_praying for select
  using (membership_id in (select m.id from public.memberships m where m.user_id = auth.uid()));
create policy praying_write on public.prayer_praying for all
  using (membership_id in (select m.id from public.memberships m where m.user_id = auth.uid()))
  with check (membership_id in (select m.id from public.memberships m where m.user_id = auth.uid()));

-- team care: ROSTER_EDIT_ROLES only, read and write. The tab must never
-- render for anyone else, and the rows must never reach them either.
create policy care_all on public.care_notes for all
  using (public.has_role(org_id, array['coach','leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['coach','leader','owner']::public.membership_role[]));

-- calendar and pushes: members read; LEADER_ROLES write.
create policy events_read on public.events for select using (public.is_member(org_id));
create policy events_write on public.events for all
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['leader','owner']::public.membership_role[]));
create policy events_propose on public.events for insert
  with check (public.has_role(org_id, array['coach','captain','scorekeeper']::public.membership_role[]) and status = 'proposed' and rsvp_closed = false);

-- rsvps: answer for yourself while the event is open; the volunteer set
-- sees names, everyone else sees counts through rsvp_counts().
create policy rsvp_own_read on public.rsvps for select
  using (membership_id in (select m.id from public.memberships m where m.user_id = auth.uid()));
create policy rsvp_staff_read on public.rsvps for select
  using (public.has_role(org_id, array['coach','scorekeeper','leader','owner']::public.membership_role[]));
create policy rsvp_answer on public.rsvps for insert
  with check (membership_id in (select m.id from public.memberships m where m.user_id = auth.uid() and m.org_id = rsvps.org_id)
    and exists (select 1 from public.events e where e.id = event_id and e.org_id = rsvps.org_id and not e.rsvp_closed and e.status = 'approved'));
create policy rsvp_change on public.rsvps for update
  using (membership_id in (select m.id from public.memberships m where m.user_id = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = event_id and not e.rsvp_closed));

-- chat: one rule for reading and posting, by thread.
create policy chat_read on public.chat_messages for select using (public.chat_can(org_id, thread_id, false));
create policy chat_post on public.chat_messages for insert
  with check (public.chat_can(org_id, thread_id, true)
    and author in (select m.id from public.memberships m where m.user_id = auth.uid() and m.org_id = chat_messages.org_id));

create policy challenges_read on public.challenges for select using (public.is_member(org_id));
create policy challenges_write on public.challenges for all
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['leader','owner']::public.membership_role[]));

-- access requests: you file and read your own; LEADER_ROLES read all.
-- Deciding goes through decide_access() so the membership is created atomically.
create policy access_file on public.access_requests for insert
  with check (user_id = auth.uid() and status = 'pending');
create policy access_read_own on public.access_requests for select using (user_id = auth.uid());
create policy access_read_leader on public.access_requests for select
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]));

-- audit log: LEADER_ROLES read; any member appends their own lines.
create policy log_read on public.activity_log for select
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]));
create policy log_append on public.activity_log for insert
  with check (public.is_member(org_id) and actor in (select m.id from public.memberships m where m.user_id = auth.uid()));

-- practice: you log your own; SHEET_ROLES see everyone's, a captain sees
-- their own squad's — "your leaders see that you showed up".
create policy practice_own on public.practice_log for select
  using (membership_id in (select m.id from public.memberships m where m.user_id = auth.uid()));
create policy practice_staff on public.practice_log for select
  using (public.has_role(org_id, array['coach','scorekeeper','leader','owner']::public.membership_role[]));
create policy practice_captain on public.practice_log for select
  using (exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.org_id = practice_log.org_id and m.role = 'captain' and m.team_id = practice_log.team_id
  ));
create policy practice_log_own on public.practice_log for insert
  with check (public.is_member(org_id) and membership_id in (select m.id from public.memberships m where m.user_id = auth.uid() and m.org_id = practice_log.org_id));

-- albums: members read and add their own; LEADER_ROLES remove anything.
create policy media_read on public.media_items for select using (public.is_member(org_id));
create policy media_add on public.media_items for insert
  with check (public.is_member(org_id) and created_by in (select m.id from public.memberships m where m.user_id = auth.uid() and m.org_id = media_items.org_id));
create policy media_remove on public.media_items for delete
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[])
    or created_by in (select m.id from public.memberships m where m.user_id = auth.uid()));

-- awards: vote once per period as yourself; LEADER_ROLES read the tally.
create policy vote_own_read on public.award_votes for select
  using (membership_id in (select m.id from public.memberships m where m.user_id = auth.uid()));
create policy vote_tally on public.award_votes for select
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]));
create policy vote_cast on public.award_votes for insert
  with check (membership_id in (select m.id from public.memberships m where m.user_id = auth.uid() and m.org_id = award_votes.org_id));
create policy nominee_read on public.award_nominees for select using (public.is_member(org_id));
create policy nominee_add on public.award_nominees for insert
  with check (nominated_by in (select m.id from public.memberships m where m.user_id = auth.uid() and m.org_id = award_nominees.org_id));
create policy nominee_remove on public.award_nominees for delete
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]));

-- library: shared units for anyone signed in, your own always; LEADER_ROLES publish.
create policy library_read on public.library_units for select
  using ((shared and auth.uid() is not null) or public.is_member(org_id));
create policy library_publish on public.library_units for all
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['leader','owner']::public.membership_role[]));

-- curated documents: members read; LEADER_ROLES write.
create policy docs_read on public.ministry_docs for select using (public.is_member(org_id));
create policy docs_write on public.ministry_docs for all
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['leader','owner']::public.membership_role[]));

-- ─────────────────────────────────────────────────────────────────────────
-- RPCs
-- ─────────────────────────────────────────────────────────────────────────

-- Start a ministry: the caller becomes its owner, with four squads and the
-- seven standard categories so the board is usable on the first night.
create or replace function public.create_ministry(p_name text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  insert into public.organizations (name, config)
    values (trim(p_name), jsonb_build_object(
      'ministryName', trim(p_name), 'pointBase', 400, 'weekGrowthPct', 8, 'goalValue', 25,
      'versePts', 20, 'verseBoard', 25, 'weekNumber', 1, 'seasonWeeks', 9, 'meetingDates', '[]'::jsonb,
      'gameName', '', 'venueAddress', '', 'parentCode', upper(substr(md5(gen_random_uuid()::text), 1, 6)),
      'church', jsonb_build_object('address','','phone','','email','','web','','studentsPage','','instagram','','youtube','','facebook','','tiktok',''),
      'checkinAutoCats', jsonb_build_object('visitors', true)))
    returning id into v_org;
  insert into public.memberships (org_id, user_id, role, display_name)
    values (v_org, auth.uid(), 'owner', coalesce(nullif(trim(p_display_name), ''), 'Owner')),
           (v_org, auth.uid(), 'leader', coalesce(nullif(trim(p_display_name), ''), 'Owner'));
  insert into public.teams (org_id, name, color, sort) values
    (v_org, 'Yellow', '#EAB308', 0), (v_org, 'Red', '#DC2626', 1), (v_org, 'Blue', '#2563EB', 2), (v_org, 'Green', '#16A34A', 3);
  insert into public.categories (org_id, key, label, color, icon, hint, sort) values
    (v_org, 'general', 'General', '#EA580C', 'ph ph-user-check', 'Attendance, volunteering, sportsmanship', 0),
    (v_org, 'spiritwear', 'Spiritwear', '#DB2777', 'ph ph-t-shirt', 'League shirt, theme dress, best dressed', 1),
    (v_org, 'bible', 'Bible', '#0891B2', 'ph ph-book-bookmark', 'Brought a Bible', 2),
    (v_org, 'verses', 'Verses', '#968ae0', 'ph ph-book-open-text', 'Sunday verse and week verse', 3),
    (v_org, 'visitors', 'Visitors', '#7C3AED', 'ph ph-user-plus', 'Friends brought — the big one', 4),
    (v_org, 'games', 'Games', '#0D9488', 'ph ph-trophy', 'Placement, stopwatch, penalties', 5),
    (v_org, 'media', 'Media', '#65A30D', 'ph ph-video-camera', 'Commercial, chant, mascot story', 6);
  return v_org;
end $$;

-- Ask to join a ministry with its invite code. Lands in the leader queue.
create or replace function public.request_access(p_code text, p_role public.membership_role, p_name text, p_note text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select id into v_org from public.organizations where invite_code = upper(trim(p_code));
  if v_org is null then raise exception 'no ministry has that code'; end if;
  -- Nobody can ask their way into owning the ministry.
  if p_role = 'owner' then raise exception 'owner is granted, not requested'; end if;
  insert into public.access_requests (org_id, user_id, name, email, requested_role, note)
    values (v_org, auth.uid(), trim(p_name), coalesce((select email from auth.users where id = auth.uid()), ''), p_role, coalesce(p_note, ''))
    returning id into v_id;
  return v_id;
end $$;

-- Approve or deny. LEADER_ROLES only; approval creates the membership and
-- both write the audit line with the decider's membership.
create or replace function public.decide_access(p_request uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.access_requests;
begin
  select * into r from public.access_requests where id = p_request for update;
  if r.id is null then raise exception 'no such request'; end if;
  if not public.has_role(r.org_id, array['leader','owner']::public.membership_role[]) then
    raise exception 'only a ministry leader can decide access';
  end if;
  if r.status <> 'pending' then return; end if;
  update public.access_requests set status = case when p_approve then 'approved' else 'denied' end::public.access_status,
    decided_at = now() where id = r.id;
  if p_approve then
    insert into public.memberships (org_id, user_id, role, display_name)
      values (r.org_id, r.user_id, r.requested_role, r.name)
      on conflict (org_id, user_id, role) do nothing;
  end if;
  insert into public.activity_log (org_id, actor, line)
    values (r.org_id, public.my_membership(r.org_id),
            case when p_approve then 'Approved ' else 'Denied ' end || r.name || ' as ' || r.requested_role);
end $$;

-- Praying is a per-person toggle; the count is derived so it cannot drift.
create or replace function public.set_praying(p_request uuid, p_on boolean)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_me uuid;
  v_count int;
begin
  select org_id into v_org from public.prayer_requests where id = p_request and status = 'wall';
  if v_org is null then raise exception 'not on the wall'; end if;
  v_me := public.my_membership(v_org);
  if v_me is null then raise exception 'not a member'; end if;
  if p_on then
    insert into public.prayer_praying values (p_request, v_me) on conflict do nothing;
  else
    delete from public.prayer_praying where request_id = p_request and membership_id = v_me;
  end if;
  select count(*) into v_count from public.prayer_praying where request_id = p_request;
  update public.prayer_requests set praying = v_count where id = p_request;
  return v_count;
end $$;

grant execute on function public.has_role(uuid, public.membership_role[]) to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.my_membership(uuid) to authenticated;
grant execute on function public.create_ministry(text, text) to authenticated;
grant execute on function public.request_access(text, public.membership_role, text, text) to authenticated;
grant execute on function public.decide_access(uuid, boolean) to authenticated;
grant execute on function public.set_praying(uuid, boolean) to authenticated;
grant execute on function public.chat_can(uuid, text, boolean) to authenticated;

-- Head counts for every event, for anyone in the ministry — no names.
create or replace function public.rsvp_counts(p_org uuid)
returns table (event_id uuid, going int, maybe int, out_count int, guests int)
language sql stable security definer set search_path = public as $$
  select r.event_id,
         count(*) filter (where r.status = 'going')::int,
         count(*) filter (where r.status = 'maybe')::int,
         count(*) filter (where r.status = 'out')::int,
         coalesce(sum(r.guests) filter (where r.status = 'going'), 0)::int
  from public.rsvps r
  where r.org_id = p_org and public.is_member(p_org)
  group by r.event_id
$$;
grant execute on function public.rsvp_counts(uuid) to authenticated;

-- Live standings and the shared run sheet travel over realtime.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.score_entries, public.nights, public.chat_messages, public.rsvps;
  end if;
end $$;

-- ── storage: the 'media' bucket ─────────────────────────────────────────
-- Private. A member reads and writes under their own ministry's folder;
-- the first path segment is the org id. Skipped where there is no storage
-- schema (the plain-Postgres RLS tests).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('media', 'media', false) on conflict (id) do nothing;
    execute $p$create policy media_obj_read on storage.objects for select
      using (bucket_id = 'media' and public.is_member(((storage.foldername(name))[1])::uuid))$p$;
    execute $p$create policy media_obj_write on storage.objects for insert
      with check (bucket_id = 'media' and public.is_member(((storage.foldername(name))[1])::uuid))$p$;
    execute $p$create policy media_obj_delete on storage.objects for delete
      using (bucket_id = 'media' and public.has_role(((storage.foldername(name))[1])::uuid, array['leader','owner']::public.membership_role[]))$p$;
  end if;
end $$;
