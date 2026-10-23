-- Live ministry time: short activities run from a leader's phone, answered
-- on students' phones, shown on the room screen. App users only.
--
-- The activities themselves (with their correct answers) live in the plan
-- document, which only leaders read — see docs_read below. The room is the
-- public snapshot every member may see; answers are one row per person per
-- activity and can only be written while that activity is open.

-- ── the plan and the season interview are leaders' working documents ────
-- They hold debrief notes ("who needs a follow-up") and trivia answers, so
-- they are not for every member. Everything else in ministry_docs still is.
drop policy if exists docs_read on public.ministry_docs;
create policy docs_read on public.ministry_docs for select using (
  public.is_member(org_id)
  and (key not in ('plan', 'seasons') or public.has_role(org_id, array['leader','owner']::public.membership_role[]))
);

-- ── the room ───────────────────────────────────────────────────────────
create table public.live_rooms (
  org_id uuid not null references public.organizations(id) on delete cascade,
  meeting_date date not null,
  state jsonb not null default '{}'::jsonb check (pg_column_size(state) < 64000),
  updated_at timestamptz not null default now(),
  primary key (org_id, meeting_date)
);
alter table public.live_rooms enable row level security;
create policy live_rooms_read on public.live_rooms for select using (public.is_member(org_id));
create policy live_rooms_write on public.live_rooms for all
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['leader','owner']::public.membership_role[]));

-- ── answers ────────────────────────────────────────────────────────────
create table public.live_answers (
  org_id uuid not null references public.organizations(id) on delete cascade,
  meeting_date date not null,
  activity_id text not null check (length(activity_id) between 1 and 60),
  member_id uuid not null references public.memberships(id) on delete cascade,
  -- first name from the roster, set by the database; never typed
  name text not null default '',
  nick text not null default '' check (length(nick) <= 24),
  side smallint check (side in (0, 1)),
  answer jsonb not null check (pg_column_size(answer) < 2000),
  -- stamped by the database, so speed can't be claimed
  answered_at timestamptz not null default now(),
  primary key (org_id, meeting_date, activity_id, member_id)
);
alter table public.live_answers enable row level security;

-- Open means the room names this activity and its timer (plus a moment for
-- the network) hasn't run out.
create or replace function public.live_open(p_org uuid, p_date date, p_act text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.live_rooms r
    where r.org_id = p_org and r.meeting_date = p_date
      and r.state->>'open' = p_act
      and (r.state->>'endsAt' is null or (r.state->>'endsAt')::bigint + 3000 >= floor(extract(epoch from now()) * 1000))
  )
$$;
grant execute on function public.live_open(uuid, date, text) to authenticated;

create or replace function public.live_answer_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m public.memberships;
begin
  select * into m from public.memberships where id = new.member_id;
  new.name := split_part(trim(coalesce(nullif(m.student_name, ''), m.display_name, '')), ' ', 1);
  new.nick := left(trim(coalesce(new.nick, '')), 24);
  new.answered_at := now();
  return new;
end $$;
create trigger live_answer_stamp before insert or update on public.live_answers
  for each row execute function public.live_answer_stamp();

-- Each person reads their own answers; leaders read the room's.
create policy live_answers_read on public.live_answers for select using (
  member_id = public.my_membership(org_id)
  or public.has_role(org_id, array['leader','owner']::public.membership_role[])
);
-- A person answers for themselves, only while the activity is open.
create policy live_answers_insert on public.live_answers for insert with check (
  member_id = public.my_membership(org_id) and public.live_open(org_id, meeting_date, activity_id)
);
create policy live_answers_update on public.live_answers for update
  using (member_id = public.my_membership(org_id))
  with check (member_id = public.my_membership(org_id) and public.live_open(org_id, meeting_date, activity_id));
-- Leaders can clear a night's answers to run it again.
create policy live_answers_clear on public.live_answers for delete
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.live_rooms, public.live_answers;
  end if;
end $$;
