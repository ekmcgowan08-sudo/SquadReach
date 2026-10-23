-- Two decisions, made safe by default.
--
-- 1. Only an owner makes an owner. Leaders still add, change and remove
--    everyone else, but can't grant owner, and can't change or remove an
--    owner's membership.
--
-- 2. Direct messages. Two adults on the team (coach, scorekeeper, leader,
--    owner) can message each other privately. A thread with a student is
--    "open door": every leader can read it. Students can't message each
--    other. A thread id is 'dm:<membership>:<membership>', smaller id first.

drop policy members_manage on public.memberships;
create policy members_manage_owner on public.memberships for all
  using (public.has_role(org_id, array['owner']::public.membership_role[]))
  with check (public.has_role(org_id, array['owner']::public.membership_role[]));
create policy members_manage_leader on public.memberships for all
  using (public.has_role(org_id, array['leader']::public.membership_role[]) and role <> 'owner')
  with check (public.has_role(org_id, array['leader']::public.membership_role[]) and role <> 'owner');

-- The two people in a DM thread id, as memberships of this ministry.
create or replace function public.dm_parties(org uuid, thread text)
returns table (id uuid, user_id uuid, role public.membership_role)
language sql stable security definer set search_path = public as $$
  select m.id, m.user_id, m.role from public.memberships m
  where m.org_id = org
    and thread ~ '^dm:[0-9a-f-]{36}:[0-9a-f-]{36}$'
    and split_part(thread, ':', 2) < split_part(thread, ':', 3)
    and m.id::text in (split_part(thread, ':', 2), split_part(thread, ':', 3))
$$;

create or replace function public.chat_can(org uuid, thread text, posting boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when thread = 'all' then
      case when posting then public.has_role(org, array['coach','scorekeeper','leader','owner']::public.membership_role[]) else public.is_member(org) end
    when thread = 'leaders' then public.has_role(org, array['coach','scorekeeper','leader','owner']::public.membership_role[])
    when thread like 'team-%' then
      public.has_role(org, array['coach','scorekeeper','leader','owner']::public.membership_role[])
      or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id = org and m.team_id::text = substr(thread, 6))
    when thread like 'dm:%' then
      -- Two distinct people, at least one of them an adult on the team.
      (select count(*) from public.dm_parties(org, thread)) = 2
      and exists (select 1 from public.dm_parties(org, thread) p where p.role in ('coach','scorekeeper','leader','owner'))
      and (
        -- you are one of the two
        exists (select 1 from public.dm_parties(org, thread) p where p.user_id = auth.uid())
        -- or it involves a student and you are a leader reading the open door
        or (not posting
            and exists (select 1 from public.dm_parties(org, thread) p where p.role in ('member','captain'))
            and public.has_role(org, array['leader','owner']::public.membership_role[]))
      )
    else false
  end;
$$;

-- Who you can start a message with. Adults on the team see everyone;
-- students see only the adults.
create or replace function public.chat_directory(p_org uuid)
returns table (id uuid, name text, role public.membership_role, team_id uuid)
language sql stable security definer set search_path = public as $$
  select m.id, m.display_name, m.role, m.team_id from public.memberships m
  where m.org_id = p_org and public.is_member(p_org)
    and (public.has_role(p_org, array['coach','scorekeeper','leader','owner']::public.membership_role[])
         or m.role in ('coach','scorekeeper','leader','owner'))
  order by m.display_name
$$;
grant execute on function public.chat_directory(uuid) to authenticated;
