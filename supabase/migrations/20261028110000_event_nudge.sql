-- "Nudge the people who haven't answered", on an event (Calendar). One a
-- day, for the whole ministry — whichever leader taps it — and it pushes
-- everyone the event is for who has an account and hasn't answered. The
-- announcement-thread post and the families' copy are written by the app
-- as before.
alter table public.events add column if not exists nudged_at timestamptz;

-- Null when someone already nudged within the day; else how many people
-- the push was queued for.
create or replace function public.event_nudge(p_event uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  e public.events;
  v_roles public.membership_role[];
  v_users uuid[];
begin
  select * into e from public.events where id = p_event for update;
  if e.id is null then raise exception 'no such event'; end if;
  if not public.has_role(e.org_id, array['leader','owner']::public.membership_role[]) then
    raise exception 'only a ministry leader can nudge';
  end if;
  if e.status <> 'approved' or e.rsvp_closed then raise exception 'that event isn''t taking answers'; end if;
  if e.nudged_at is not null and e.nudged_at > now() - interval '20 hours' then return null; end if;
  update public.events set nudged_at = now() where id = e.id;

  select coalesce(array_agg(distinct r), '{}') into v_roles
    from (select case a when 'members' then 'member' when 'captains' then 'captain' when 'coaches' then 'coach'
                        when 'scorekeeper' then 'scorekeeper' when 'leaders' then 'leader' when 'admins' then 'owner' end::public.membership_role as r
          from unnest(e.audiences) a) x
    where r is not null;
  select coalesce(array_agg(distinct m.user_id), '{}') into v_users
    from public.memberships m
    where m.org_id = e.org_id and m.role = any(v_roles)
      and not exists (select 1 from public.rsvps r join public.memberships m2 on m2.id = r.membership_id
                      where r.event_id = e.id and m2.user_id = m.user_id);
  perform public.push_enqueue(e.org_id, v_users, 'event',
    'Are you coming to ' || e.title || '?',
    coalesce(nullif(e.date_label, ''), to_char(e.day, 'Dy, Mon FMDD'), 'Soon') || ' — answer on the Calendar.',
    '/dashboard/events/' || e.id, 'rsvp:' || e.id || ':' || to_char(now(), 'YYYY-MM-DD HH24'));
  return cardinality(array_remove(v_users, auth.uid()));
end $$;
grant execute on function public.event_nudge(uuid) to authenticated;
