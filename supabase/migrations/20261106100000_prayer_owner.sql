-- A prayer request is readable only by the leader it's assigned to. Every
-- other leader sees that it exists, who sent it and who has it — never what
-- it says. A request waits for a leader to take it; once someone has it,
-- only they (or an owner) hand it on. The wall is read by everyone, and a
-- person always reads what they sent.
--
-- What a request says is only reachable through prayer_bodies(): the body
-- column itself isn't readable by anyone signed in.
alter table public.prayer_requests
  add column if not exists assigned_to uuid references public.memberships(id) on delete set null,
  add column if not exists assigned_name text;

-- Run again by the tests after they mirror Supabase's default table grants.
create or replace function public.prayer_column_grants() returns void
language plpgsql set search_path = public as $$
begin
  revoke select, update on public.prayer_requests from anon, authenticated;
  grant select (id, org_id, author, who, meta, status, praying, answered, created_at, assigned_to, assigned_name) on public.prayer_requests to authenticated;
  -- Status and answered only: who has it changes through prayer_take().
  grant update (status, answered) on public.prayer_requests to authenticated;
end $$;
select public.prayer_column_grants();

-- Posting or holding a request means reading it, so only its leader does;
-- marking one on the wall answered stays with any leader.
drop policy if exists prayer_decide on public.prayer_requests;
create policy prayer_decide on public.prayer_requests for update
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[])
         and (status = 'wall' or exists (select 1 from public.memberships m where m.id = assigned_to and m.user_id = auth.uid())))
  with check (public.has_role(org_id, array['leader','owner']::public.membership_role[]));

-- What each request says, for whoever may read it, and whether it's yours to decide.
create or replace function public.prayer_bodies(p_org uuid)
returns table (id uuid, body text, mine boolean)
language sql stable security definer set search_path = public as $$
  select r.id, r.body,
         exists (select 1 from public.memberships m where m.id = r.assigned_to and m.user_id = auth.uid())
  from public.prayer_requests r
  where r.org_id = p_org and (
    (r.status = 'wall' and public.is_member(p_org))
    or exists (select 1 from public.memberships m where m.id = r.author and m.user_id = auth.uid())
    or (exists (select 1 from public.memberships m where m.id = r.assigned_to and m.user_id = auth.uid())
        and public.has_role(p_org, array['leader','owner']::public.membership_role[]))
  );
$$;
grant execute on function public.prayer_bodies(uuid) to authenticated;

-- Take a request (p_to null), or hand it to another leader. Taking one
-- someone else has is for an owner only, and the audit log keeps who did.
create or replace function public.prayer_take(p_request uuid, p_to uuid default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  r public.prayer_requests;
  v_me uuid;
  v_to uuid;
  v_name text;
begin
  select * into r from public.prayer_requests where id = p_request for update;
  if r.id is null then raise exception 'no such request'; end if;
  if not public.has_role(r.org_id, array['leader','owner']::public.membership_role[]) then
    raise exception 'only a ministry leader can take a prayer request';
  end if;
  if r.status = 'wall' then raise exception 'that one is already on the wall'; end if;
  v_me := public.my_membership(r.org_id);
  v_to := coalesce(p_to, v_me);
  select display_name into v_name from public.memberships m
    where m.id = v_to and m.org_id = r.org_id and m.role in ('leader', 'owner');
  if v_name is null then raise exception 'that person isn''t a leader here'; end if;
  if r.assigned_to is not null
     and not exists (select 1 from public.memberships m where m.id = r.assigned_to and m.user_id = auth.uid())
     and not public.has_role(r.org_id, array['owner']::public.membership_role[]) then
    raise exception 'it''s already with %', r.assigned_name;
  end if;
  update public.prayer_requests set assigned_to = v_to, assigned_name = v_name where id = r.id;
  insert into public.activity_log (org_id, actor, line)
    values (r.org_id, v_me, case when v_to = v_me then 'Took a prayer request from ' || r.who || ' to read'
                                 else 'Handed a prayer request from ' || r.who || ' to ' || v_name end);
  return v_name;
end $$;
grant execute on function public.prayer_take(uuid, uuid) to authenticated;

-- The push to leaders says to take it, since nobody can read it until then.
create or replace function public.push_on_prayer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'queued' then return new; end if;
  perform public.push_enqueue(new.org_id, public.push_users(new.org_id, array['leader','owner']::public.membership_role[]), 'prayer',
    'New prayer request', 'Take it to read it — nothing is public until it’s posted.', '/dashboard/follow-ups', 'prayer:' || new.id);
  return new;
end $$;
