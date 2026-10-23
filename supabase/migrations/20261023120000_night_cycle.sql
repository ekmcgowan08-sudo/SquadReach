-- The week around the night: prep reminders, how students got in, follow-ups,
-- notes, pickup, the door, the volunteer schedule, and what families see.
--
-- Role lists mirror lib/types/domain.ts, as in the first migration:
--   LEADER_ROLES       leader, owner
--   ROSTER_EDIT_ROLES  coach, leader, owner
--   SCORE_ENTRY_ROLES  coach, scorekeeper, leader, owner
--
-- Families never get an account. Each student's family has a private token;
-- three SECURITY DEFINER functions (family_view, family_sign, family_read)
-- answer for that one student and nothing else, as the anonymous role.

-- ── how a student got in ────────────────────────────────────────────────
alter table public.attendance add column via text not null default 'leader' check (via in ('qr', 'leader'));

-- A student's membership names their roster row, so "my squad", "my points"
-- and self check-in can find them. Approval now records it; rows approved
-- before this get it from their display name.
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
    insert into public.memberships (org_id, user_id, role, display_name, student_name)
      values (r.org_id, r.user_id, r.requested_role, r.name,
              case when r.requested_role in ('member', 'captain') then r.name end)
      on conflict (org_id, user_id, role) do nothing;
  end if;
  insert into public.activity_log (org_id, actor, line)
    values (r.org_id, public.my_membership(r.org_id),
            case when p_approve then 'Approved ' else 'Denied ' end || r.name || ' as ' || r.requested_role);
end $$;
update public.memberships set student_name = display_name where role in ('member', 'captain') and student_name is null;

-- The person signed in, by the name they go by in this ministry.
create or replace function public.my_name(org uuid)
returns text language sql stable security definer set search_path = public as $$
  select m.display_name from public.memberships m where m.id = public.my_membership(org)
$$;

-- ── per night ──────────────────────────────────────────────────────────
create table public.night_reminders (
  org_id uuid not null references public.organizations(id) on delete cascade,
  meeting_date date not null,
  reminder_id text not null check (length(reminder_id) between 1 and 40),
  off boolean not null default false,
  sent_at timestamptz,
  body text check (length(body) <= 600),
  updated_at timestamptz not null default now(),
  primary key (org_id, meeting_date, reminder_id)
);

create table public.night_followups (
  org_id uuid not null references public.organizations(id) on delete cascade,
  meeting_date date not null,
  item_id text not null check (length(item_id) between 1 and 120),
  done boolean not null default false,
  done_at timestamptz,
  body text check (length(body) <= 1200),
  done_by text not null default '',
  primary key (org_id, meeting_date, item_id)
);

create table public.night_notes (
  org_id uuid not null references public.organizations(id) on delete cascade,
  meeting_date date not null,
  went_well text not null default '' check (length(went_well) <= 2000),
  change_next text not null default '' check (length(change_next) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (org_id, meeting_date)
);

create table public.night_pickup (
  org_id uuid not null references public.organizations(id) on delete cascade,
  meeting_date date not null,
  shift_min int not null default 0 check (shift_min between -180 and 180),
  primary key (org_id, meeting_date)
);

-- Someone at the door who isn't on any roster. They don't add themselves
-- (decided in review); a leader comes over.
create table public.door_flags (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meeting_date date not null,
  name text not null check (length(name) between 1 and 80),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── serving ────────────────────────────────────────────────────────────
create table public.serve_schedule (
  org_id uuid not null references public.organizations(id) on delete cascade,
  meeting_date date not null,
  role text not null check (length(role) between 1 and 60),
  name text check (length(name) <= 80),
  primary key (org_id, meeting_date, role)
);

create table public.serve_availability (
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  meeting_date date not null,
  state text not null check (state in ('yes', 'no')),
  primary key (org_id, name, meeting_date)
);

-- A swap changes nothing until the coordinator approves it.
create table public.serve_swaps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  from_name text not null,
  meeting_date date not null,
  role text not null,
  to_name text,
  why text not null default '' check (length(why) <= 400),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_by text,
  created_at timestamptz not null default now()
);

create table public.volunteer_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  contact text not null default '' check (length(contact) <= 120),
  role text not null default 'Volunteer',
  status text not null default 'sent' check (status in ('sent', 'accepted')),
  created_at timestamptz not null default now()
);

-- ── families ───────────────────────────────────────────────────────────
-- Guardian details are roster data: coaches and leaders only. The token is
-- the family's private link; a new one revokes the old.
create table public.families (
  org_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  guardian text not null default '' check (length(guardian) <= 80),
  contact text not null default '' check (length(contact) <= 120),
  token text not null unique check (length(token) >= 16),
  primary key (org_id, student_id)
);

-- kids: null for everyone, else the student names it covers.
create table public.permission_slips (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  due text not null check (due ~ '^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$'),
  kids jsonb,
  created_at timestamptz not null default now()
);

create table public.slip_signatures (
  slip_id uuid not null references public.permission_slips(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  signed_by text not null check (length(signed_by) between 1 and 120),
  signed_at timestamptz not null default now(),
  primary key (slip_id, student_id)
);

-- kids is resolved when sent, so a later roster change can't widen who got it.
create table public.parent_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  author uuid references public.memberships(id) on delete set null,
  from_name text not null default '',
  audience text not null,
  kids jsonb not null default '[]'::jsonb,
  body text not null check (length(body) between 1 and 1600),
  created_at timestamptz not null default now()
);

create table public.parent_message_reads (
  message_id uuid not null references public.parent_messages(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, student_id)
);

alter table public.night_reminders enable row level security;
alter table public.night_followups enable row level security;
alter table public.night_notes enable row level security;
alter table public.night_pickup enable row level security;
alter table public.door_flags enable row level security;
alter table public.serve_schedule enable row level security;
alter table public.serve_availability enable row level security;
alter table public.serve_swaps enable row level security;
alter table public.volunteer_invites enable row level security;
alter table public.families enable row level security;
alter table public.permission_slips enable row level security;
alter table public.slip_signatures enable row level security;
alter table public.parent_messages enable row level security;
alter table public.parent_message_reads enable row level security;

-- Reminders: volunteers read what went out; leaders time, word and post them.
create policy night_rem_read on public.night_reminders for select
  using (public.has_role(org_id, array['coach','scorekeeper','leader','owner']::public.membership_role[]));
create policy night_rem_write on public.night_reminders for all
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['leader','owner']::public.membership_role[]));

-- Follow-ups, notes and the door are roster work.
create policy night_fu_all on public.night_followups for all
  using (public.has_role(org_id, array['coach','leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['coach','leader','owner']::public.membership_role[]));
create policy night_notes_all on public.night_notes for all
  using (public.has_role(org_id, array['coach','leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['coach','leader','owner']::public.membership_role[]));
create policy door_flags_all on public.door_flags for all
  using (public.has_role(org_id, array['coach','leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['coach','leader','owner']::public.membership_role[]));

-- Pickup is a leader's call; volunteers can read it.
create policy night_pickup_read on public.night_pickup for select
  using (public.has_role(org_id, array['coach','scorekeeper','leader','owner']::public.membership_role[]));
create policy night_pickup_write on public.night_pickup for all
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['leader','owner']::public.membership_role[]));

-- Serving: the volunteer set reads the schedule; the coordinator writes it.
create policy serve_sched_read on public.serve_schedule for select
  using (public.has_role(org_id, array['coach','scorekeeper','leader','owner']::public.membership_role[]));
create policy serve_sched_write on public.serve_schedule for all
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['leader','owner']::public.membership_role[]));

-- Availability: your own name only (leaders may set anyone's).
create policy serve_avail_read on public.serve_availability for select
  using (public.has_role(org_id, array['coach','scorekeeper','leader','owner']::public.membership_role[]));
create policy serve_avail_own on public.serve_availability for all
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[])
         or (public.has_role(org_id, array['coach','scorekeeper']::public.membership_role[]) and name = public.my_name(org_id)))
  with check (public.has_role(org_id, array['leader','owner']::public.membership_role[])
         or (public.has_role(org_id, array['coach','scorekeeper']::public.membership_role[]) and name = public.my_name(org_id)));

-- Swaps: you ask as yourself, pending; only the coordinator decides.
create policy serve_swaps_read on public.serve_swaps for select
  using (public.has_role(org_id, array['coach','scorekeeper','leader','owner']::public.membership_role[]));
create policy serve_swaps_ask on public.serve_swaps for insert
  with check (status = 'pending' and decided_by is null
              and public.has_role(org_id, array['coach','scorekeeper','leader','owner']::public.membership_role[])
              and from_name = public.my_name(org_id));
create policy serve_swaps_decide on public.serve_swaps for update
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['leader','owner']::public.membership_role[]));
create policy serve_swaps_remove on public.serve_swaps for delete
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]));

create policy invites_all on public.volunteer_invites for all
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['leader','owner']::public.membership_role[]));

-- Families: guardian contact is coaches and leaders only.
create policy families_all on public.families for all
  using (public.has_role(org_id, array['coach','leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['coach','leader','owner']::public.membership_role[]));

-- Slips: coaches see who has signed; leaders send slips and record paper ones.
create policy slips_read on public.permission_slips for select
  using (public.has_role(org_id, array['coach','leader','owner']::public.membership_role[]));
create policy slips_write on public.permission_slips for all
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['leader','owner']::public.membership_role[]));
create policy slip_sig_read on public.slip_signatures for select
  using (public.has_role(org_id, array['coach','leader','owner']::public.membership_role[]));
create policy slip_sig_write on public.slip_signatures for all
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['leader','owner']::public.membership_role[]));

-- Messages to families: leaders write and read them, as themselves.
create policy pmsg_read on public.parent_messages for select
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]));
create policy pmsg_write on public.parent_messages for insert
  with check (public.has_role(org_id, array['leader','owner']::public.membership_role[]) and author = public.my_membership(org_id));
create policy pmsg_reads_read on public.parent_message_reads for select
  using (exists (select 1 from public.parent_messages m where m.id = message_id and public.has_role(m.org_id, array['leader','owner']::public.membership_role[])));

-- ── a student checks themselves in ──────────────────────────────────────
-- Only their own row, only on a meeting night (today, give or take the
-- timezone), only as present.
create or replace function public.self_check_in(p_org uuid, p_date date)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_mem public.memberships;
  v_student uuid;
begin
  select * into v_mem from public.memberships
   where org_id = p_org and user_id = auth.uid() and student_name is not null
   limit 1;
  if v_mem.id is null then raise exception 'not a student in this ministry'; end if;
  if abs(p_date - current_date) > 1 then raise exception 'check-in is for tonight only'; end if;
  if not exists (
    select 1 from public.organizations o, jsonb_array_elements_text(coalesce(o.config->'meetingDates', '[]'::jsonb)) d
    where o.id = p_org and d = p_date::text
  ) then raise exception 'not a meeting night'; end if;
  select id into v_student from public.students where org_id = p_org and name = v_mem.student_name;
  if v_student is null then raise exception 'not on a roster'; end if;
  insert into public.attendance (org_id, meeting_date, student_id, present, via, marked_by)
    values (p_org, p_date, v_student, true, 'qr', v_mem.id)
    on conflict (org_id, meeting_date, student_id) do update set present = true, via = 'qr', updated_at = now();
  return true;
end $$;
grant execute on function public.self_check_in(uuid, date) to authenticated;

-- ── the family link ─────────────────────────────────────────────────────
-- One student's card, by token. Returns null for a token that doesn't exist.
create or replace function public.family_view(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  f public.families;
  s public.students;
  o public.organizations;
  t public.teams;
  v_tonight date;
  v_huddle jsonb;
begin
  if p_token is null or length(p_token) < 16 then return null; end if;
  select * into f from public.families where token = p_token;
  if f.student_id is null then return null; end if;
  select * into s from public.students where id = f.student_id;
  select * into o from public.organizations where id = f.org_id;
  select * into t from public.teams where id = s.team_id;
  select coalesce(
           (select min(d::date) from jsonb_array_elements_text(coalesce(o.config->'meetingDates', '[]'::jsonb)) d where d::date >= current_date),
           (select max(d::date) from jsonb_array_elements_text(coalesce(o.config->'meetingDates', '[]'::jsonb)) d))
    into v_tonight;
  select n.huddle into v_huddle from public.nights n where n.org_id = o.id and n.meeting_date = v_tonight;
  return jsonb_build_object(
    'ministry', o.name,
    'cycle', o.config->'cycle',
    'meetingDates', coalesce(o.config->'meetingDates', '[]'::jsonb),
    'gameName', coalesce(o.config->>'gameName', ''),
    'venueAddress', coalesce(o.config->>'venueAddress', ''),
    'kid', jsonb_build_object('name', s.name, 'team', t.name, 'teamColor', t.color),
    'guardian', f.guardian,
    -- Coaches' names and jobs only, so the card can say who leads their group.
    'crew', coalesce((select jsonb_agg(jsonb_build_object('name', c->>'name', 'job', c->>'job', 'team', case when c->>'team' = s.team_id::text then t.name end))
                      from jsonb_array_elements(coalesce(v_huddle->'crew', '[]'::jsonb)) c
                      where c->>'team' = s.team_id::text), '[]'::jsonb),
    -- Times and block names only: never the staff notes.
    'runSheet', coalesce((select jsonb_agg(jsonb_build_object('time', r->>'time', 'label', r->>'label', 'debrief', coalesce((r->>'debrief')::boolean, false)))
                          from jsonb_array_elements(coalesce(v_huddle->'runSheet', '[]'::jsonb)) r), '[]'::jsonb),
    'tonight', v_tonight,
    'present', exists (select 1 from public.attendance a where a.org_id = o.id and a.meeting_date = v_tonight and a.student_id = s.id and a.present),
    'via', (select a.via from public.attendance a where a.org_id = o.id and a.meeting_date = v_tonight and a.student_id = s.id and a.present),
    'presentDates', coalesce((select jsonb_agg(a.meeting_date order by a.meeting_date) from public.attendance a
                              where a.org_id = o.id and a.student_id = s.id and a.present and a.meeting_date < v_tonight), '[]'::jsonb),
    'night', jsonb_build_object(
      'pickupShift', coalesce((select p.shift_min from public.night_pickup p where p.org_id = o.id and p.meeting_date = v_tonight), 0),
      'rem', coalesce((select jsonb_object_agg(r.reminder_id, jsonb_strip_nulls(jsonb_build_object('off', r.off, 'sentAt', (extract(epoch from r.sent_at) * 1000)::bigint, 'text', r.body)))
                       from public.night_reminders r where r.org_id = o.id and r.meeting_date = v_tonight), '{}'::jsonb)),
    'slips', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'due', p.due) order by p.due)
                       from public.permission_slips p
                       where p.org_id = o.id and (p.kids is null or p.kids ? s.name)), '[]'::jsonb),
    'signed', coalesce((select jsonb_agg(jsonb_build_object('slip', g.slip_id, 'by', g.signed_by))
                        from public.slip_signatures g where g.student_id = s.id), '[]'::jsonb),
    'msgs', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'from', m.from_name, 'text', m.body, 'at', (extract(epoch from m.created_at) * 1000)::bigint,
                                                         'read', exists (select 1 from public.parent_message_reads x where x.message_id = m.id and x.student_id = s.id))
                                      order by m.created_at desc)
                      from (select * from public.parent_messages pm where pm.org_id = o.id and pm.kids ? s.name order by pm.created_at desc limit 30) m), '[]'::jsonb)
  );
end $$;

create or replace function public.family_sign(p_token text, p_slip uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  f public.families;
  s public.students;
begin
  select * into f from public.families where token = p_token and length(p_token) >= 16;
  if f.student_id is null then raise exception 'no such family'; end if;
  select * into s from public.students where id = f.student_id;
  if not exists (select 1 from public.permission_slips p where p.id = p_slip and p.org_id = f.org_id and (p.kids is null or p.kids ? s.name)) then
    raise exception 'that slip is not for this family';
  end if;
  insert into public.slip_signatures (slip_id, student_id, org_id, signed_by)
    values (p_slip, s.id, f.org_id, coalesce(nullif(f.guardian, ''), 'Family'))
    on conflict (slip_id, student_id) do nothing;
  return true;
end $$;

create or replace function public.family_read(p_token text, p_msg uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  f public.families;
  s public.students;
begin
  select * into f from public.families where token = p_token and length(p_token) >= 16;
  if f.student_id is null then raise exception 'no such family'; end if;
  select * into s from public.students where id = f.student_id;
  if not exists (select 1 from public.parent_messages m where m.id = p_msg and m.org_id = f.org_id and m.kids ? s.name) then
    raise exception 'that message is not for this family';
  end if;
  insert into public.parent_message_reads (message_id, student_id) values (p_msg, s.id) on conflict do nothing;
  return true;
end $$;

grant execute on function public.family_view(text) to anon, authenticated;
grant execute on function public.family_sign(text, uuid) to anon, authenticated;
grant execute on function public.family_read(text, uuid) to anon, authenticated;
