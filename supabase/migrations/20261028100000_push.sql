-- Push to phones (lib/server/push.ts).
--
-- A phone that turns push on keeps its Web Push subscription here, with the
-- notifications its owner switched on or off on that phone. What is pushed,
-- and to whom, is decided here — by triggers on the rows that cause a push —
-- never by the phone that caused it: a phone can only ask the server to send
-- what is already queued. The server sends with the service role, and
-- nobody else reads the queue.
--
-- A captain's nudge is a row too, so the student sees it in the app whether
-- or not push is on for their phone, and one nudge a night is enough.

-- ── subscriptions ──────────────────────────────────────────────────────
create table public.push_subscriptions (
  endpoint text primary key check (endpoint like 'https://%' and length(endpoint) <= 1000),
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null check (length(p256dh) between 1 and 200),
  auth text not null check (length(auth) between 1 and 100),
  -- This phone's own choices (lib/prefs notifMine): trigger → on/off.
  prefs jsonb not null default '{}'::jsonb check (jsonb_typeof(prefs) = 'object'),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy push_sub_mine on public.push_subscriptions for select using (user_id = auth.uid());
create policy push_sub_drop on public.push_subscriptions for delete using (user_id = auth.uid());

-- One phone, one account: whoever last turned push on there.
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_prefs jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, prefs)
    values (p_endpoint, auth.uid(), p_p256dh, p_auth, coalesce(p_prefs, '{}'::jsonb))
    on conflict (endpoint) do update
      set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, prefs = excluded.prefs, created_at = now();
end $$;
grant execute on function public.push_subscribe(text, text, text, jsonb) to authenticated;

create or replace function public.push_prefs(p_endpoint text, p_prefs jsonb)
returns void language sql security definer set search_path = public as $$
  update public.push_subscriptions set prefs = coalesce(p_prefs, '{}'::jsonb)
  where endpoint = p_endpoint and user_id = auth.uid();
$$;
grant execute on function public.push_prefs(text, jsonb) to authenticated;

-- ── the queue ──────────────────────────────────────────────────────────
create table public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  to_users uuid[] not null,
  -- Which setting turns it off (lib/prefs NOTIF_TRIGGERS).
  trigger text not null,
  title text not null,
  body text not null default '',
  url text not null default '/dashboard',
  dedupe text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  sent int,
  unique (org_id, dedupe)
);
create index push_outbox_unsent on public.push_outbox (created_at) where sent_at is null;
-- Row level security with no policies: only the service role reads it.
alter table public.push_outbox enable row level security;

-- Everyone it's for, except whoever caused it.
create or replace function public.push_enqueue(p_org uuid, p_users uuid[], p_trigger text, p_title text, p_body text, p_url text, p_dedupe text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_users uuid[];
begin
  select coalesce(array_agg(distinct u), '{}') into v_users
    from unnest(coalesce(p_users, '{}')) u
    where u is not null and u is distinct from auth.uid();
  if cardinality(v_users) = 0 then return; end if;
  insert into public.push_outbox (org_id, to_users, trigger, title, body, url, dedupe)
    values (p_org, v_users, p_trigger, left(p_title, 120), left(coalesce(p_body, ''), 240), coalesce(p_url, '/dashboard'), p_dedupe)
    on conflict (org_id, dedupe) do nothing;
end $$;

create or replace function public.push_users(p_org uuid, p_roles public.membership_role[])
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct user_id), '{}') from public.memberships where org_id = p_org and role = any(p_roles);
$$;

-- Crew and bench are names on the huddle; a name reaches whoever goes by it.
create or replace function public.push_users_named(p_org uuid, p_name text)
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct user_id), '{}') from public.memberships
  where org_id = p_org and coalesce(p_name, '') <> '' and lower(display_name) = lower(trim(p_name));
$$;

revoke execute on function public.push_enqueue(uuid, uuid[], text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.push_users(uuid, public.membership_role[]) from public, anon, authenticated;
revoke execute on function public.push_users_named(uuid, text) from public, anon, authenticated;

-- ── what pushes ────────────────────────────────────────────────────────
create or replace function public.push_on_access() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'pending' then return new; end if;
  perform public.push_enqueue(new.org_id, public.push_users(new.org_id, array['leader','owner']::public.membership_role[]), 'roleRequest',
    new.name || ' asked to join',
    'As ' || case new.requested_role when 'member' then 'Team Member' when 'captain' then 'Captain' when 'coach' then 'Coach'
                                     when 'scorekeeper' then 'Scorekeeper' when 'leader' then 'Ministry Leader' else 'Organization Owner' end
          || ' — approve, change or deny it.',
    '/dashboard/access-requests', 'access:' || new.id);
  return new;
end $$;
create trigger push_on_access after insert on public.access_requests for each row execute function public.push_on_access();

create or replace function public.push_on_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'proposed' then return new; end if;
  perform public.push_enqueue(new.org_id, public.push_users(new.org_id, array['leader','owner']::public.membership_role[]), 'event',
    'New event proposal',
    new.title || case when coalesce(new.proposed_by, '') <> '' then ' · ' || split_part(new.proposed_by, ' · ', 1) else '' end,
    '/dashboard/calendar', 'event:' || new.id);
  return new;
end $$;
create trigger push_on_event after insert on public.events for each row execute function public.push_on_event();

-- Who sent it in and what it says stay off the lock screen.
create or replace function public.push_on_prayer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'queued' then return new; end if;
  perform public.push_enqueue(new.org_id, public.push_users(new.org_id, array['leader','owner']::public.membership_role[]), 'prayer',
    'New prayer request', 'Nothing is public until you post it.', '/dashboard/follow-ups', 'prayer:' || new.id);
  return new;
end $$;
create trigger push_on_prayer after insert on public.prayer_requests for each row execute function public.push_on_prayer();

create or replace function public.push_on_swap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'pending' then return new; end if;
  perform public.push_enqueue(new.org_id, public.push_users(new.org_id, array['leader','owner']::public.membership_role[]), 'nightCycle',
    'Swap request', new.from_name || ' can’t do ' || lower(new.role) || ' on ' || to_char(new.meeting_date, 'Dy, Mon FMDD'),
    '/dashboard/serving', 'swap:' || new.id);
  return new;
end $$;
create trigger push_on_swap after insert on public.serve_swaps for each row execute function public.push_on_swap();

create or replace function public.push_on_door() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.push_enqueue(new.org_id, public.push_users(new.org_id, array['coach','leader','owner']::public.membership_role[]), 'nightCycle',
    'Someone new at the door', new.name || ' isn’t on a roster — go say hi', '/dashboard/night-recap', 'door:' || new.id);
  return new;
end $$;
create trigger push_on_door after insert on public.door_flags for each row execute function public.push_on_door();

create or replace function public.push_on_flag() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.push_enqueue(new.org_id, public.push_users(new.org_id, array['leader','owner']::public.membership_role[]), 'chatFlag',
    'A chat was flagged for you', coalesce(nullif(new.by_name, ''), 'Someone') || ' flagged the ' || coalesce(nullif(new.thread_name, ''), 'chat') || ' thread',
    '/dashboard/chat?t=' || new.thread_id, 'flag:' || new.id);
  return new;
end $$;
create trigger push_on_flag after insert on public.chat_flags for each row execute function public.push_on_flag();

-- The huddle: a run-sheet block told to its owner, and a bench volunteer
-- asked to cover a post. Each once — a later save of the same sheet is not
-- a second push.
create or replace function public.push_on_huddle() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  h jsonb := coalesce(new.huddle, '{}'::jsonb);
  was jsonb := case when tg_op = 'UPDATE' then coalesce(old.huddle, '{}'::jsonb) else '{}'::jsonb end;
  it jsonb;
  v_name text;
  v_post text;
  v_key text;
  v_ids jsonb;
  v_id text;
begin
  for it in select * from jsonb_array_elements(case when jsonb_typeof(h->'runSheet') = 'array' then h->'runSheet' else '[]'::jsonb end) loop
    if it->>'notifiedAt' is null or it->>'assignedTo' is null then continue; end if;
    if exists (select 1 from jsonb_array_elements(case when jsonb_typeof(was->'runSheet') = 'array' then was->'runSheet' else '[]'::jsonb end) o
               where o->>'id' = it->>'id' and o->>'notifiedAt' = it->>'notifiedAt') then continue; end if;
    select c->>'name' into v_name from jsonb_array_elements(case when jsonb_typeof(h->'crew') = 'array' then h->'crew' else '[]'::jsonb end) c
      where c->>'id' = it->>'assignedTo' limit 1;
    if v_name is null then continue; end if;
    perform public.push_enqueue(new.org_id, public.push_users_named(new.org_id, v_name), 'runSheet',
      'You own ' || coalesce(it->>'time', '') || ' · ' || coalesce(it->>'label', ''),
      'It’s yours tonight.' || case when coalesce(it->>'where', '') <> '' then ' Where: ' || (it->>'where') || '.' else '' end,
      '/dashboard/huddle', 'own:' || new.meeting_date || ':' || (it->>'id') || ':' || (it->>'notifiedAt'));
  end loop;

  for v_key, v_ids in select key, value from jsonb_each(case when jsonb_typeof(h->'subAsks') = 'object' then h->'subAsks' else '{}'::jsonb end) loop
    if jsonb_typeof(v_ids) <> 'array' then continue; end if;
    v_post := null;
    if v_key like 'crew:%' then
      select c->>'post' into v_post from jsonb_array_elements(case when jsonb_typeof(h->'crew') = 'array' then h->'crew' else '[]'::jsonb end) c
        where c->>'id' = substr(v_key, 6) limit 1;
    else
      select p->>'post' into v_post from jsonb_array_elements(case when jsonb_typeof(h->'openPosts') = 'array' then h->'openPosts' else '[]'::jsonb end) p
        where p->>'id' = v_key limit 1;
    end if;
    for v_id in select jsonb_array_elements_text(v_ids) loop
      if coalesce(was->'subAsks'->v_key, '[]'::jsonb) ? v_id then continue; end if;
      select b->>'name' into v_name from jsonb_array_elements(case when jsonb_typeof(h->'bench') = 'array' then h->'bench' else '[]'::jsonb end) b
        where b->>'id' = v_id limit 1;
      if v_name is null then continue; end if;
      perform public.push_enqueue(new.org_id, public.push_users_named(new.org_id, v_name), 'runSheet',
        'Can you cover ' || coalesce(v_post, 'a post') || ' tonight?', 'Tell the leader yes or no.',
        '/dashboard/huddle', 'ask:' || new.meeting_date || ':' || v_key || ':' || v_id);
    end loop;
  end loop;
  return new;
end $$;
create trigger push_on_huddle after insert or update of huddle on public.nights for each row execute function public.push_on_huddle();

-- ── nudges ─────────────────────────────────────────────────────────────
-- 'push': to the student, from their captain or an adult. 'home': a
-- captain asks a leader to text the household (students never see a
-- family's number).
create table public.nudges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meeting_date date not null,
  student text not null check (length(student) between 1 and 120),
  kind text not null default 'push' check (kind in ('push', 'home')),
  by_membership uuid references public.memberships(id) on delete set null,
  by_name text not null default '',
  created_at timestamptz not null default now(),
  -- One is enough: more than that gets ignored.
  unique (org_id, meeting_date, student, kind)
);
alter table public.nudges enable row level security;

create or replace function public.nudge_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.by_membership := public.my_membership(new.org_id);
  new.by_name := coalesce((select display_name from public.memberships where id = new.by_membership), '');
  new.created_at := now();
  return new;
end $$;
create trigger nudge_stamp before insert on public.nudges for each row execute function public.nudge_stamp();

-- An adult on the team nudges anyone on the roster; a captain, their own squad.
create or replace function public.nudge_allowed(p_org uuid, p_student text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.students s where s.org_id = p_org and s.name = p_student and not s.guest)
    and (public.has_role(p_org, array['coach','leader','owner']::public.membership_role[])
         or exists (select 1 from public.memberships m join public.students s on s.org_id = m.org_id and s.name = p_student
                    where m.org_id = p_org and m.user_id = auth.uid() and m.role = 'captain' and m.team_id is not null and m.team_id = s.team_id));
$$;
grant execute on function public.nudge_allowed(uuid, text) to authenticated;

create policy nudge_send on public.nudges for insert
  with check (by_membership is not null and public.nudge_allowed(org_id, student));
create policy nudge_read on public.nudges for select
  using (public.has_role(org_id, array['coach','leader','owner']::public.membership_role[])
         or exists (select 1 from public.memberships m where m.id = by_membership and m.user_id = auth.uid())
         or (kind = 'push' and exists (select 1 from public.memberships m where m.org_id = nudges.org_id and m.user_id = auth.uid() and m.student_name = nudges.student)));

create or replace function public.push_on_nudge() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_first text := coalesce(nullif(split_part(new.by_name, ' ', 1), ''), 'Your captain');
begin
  if new.kind = 'push' then
    perform public.push_enqueue(new.org_id,
      (select coalesce(array_agg(distinct user_id), '{}') from public.memberships
        where org_id = new.org_id and student_name = new.student and role in ('member', 'captain')),
      'nudge', 'Your squad is looking for you', v_first || ' checked — are you coming tonight?', '/dashboard', 'nudge:' || new.id);
  else
    perform public.push_enqueue(new.org_id, public.push_users(new.org_id, array['leader','owner']::public.membership_role[]), 'nightCycle',
      'Text ' || new.student || '’s household?', v_first || ' says they aren’t here yet.',
      '/dashboard/parents?family=' || replace(replace(replace(replace(replace(new.student, '%', '%25'), ' ', '%20'), '&', '%26'), '#', '%23'), '+', '%2B'),
      'home:' || new.id);
  end if;
  return new;
end $$;
create trigger push_on_nudge after insert on public.nudges for each row execute function public.push_on_nudge();
