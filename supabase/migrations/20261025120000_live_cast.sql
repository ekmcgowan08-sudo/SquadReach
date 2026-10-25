-- Casting the room screen to a TV or a projector's own browser. A cast
-- device signs in as nobody (Chrome renders a cast page in a profile of
-- its own), so whoever can open the room screen can mint a cast link for
-- one night: a long random token that reads the room snapshot — what the
-- room is shown anyway — and nothing else, until it expires.

create table public.live_casts (
  token text primary key check (length(token) >= 48),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meeting_date date not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours'
);
create index on public.live_casts (org_id, meeting_date);
-- No policies: the table is reached only through the functions below.
alter table public.live_casts enable row level security;

-- EVENT_CONTROL_ROLES, like the room screen itself.
create or replace function public.live_cast_start(p_org uuid, p_date date)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  t text;
begin
  if not public.has_role(p_org, array['scorekeeper','leader','owner']::public.membership_role[]) then
    raise exception 'Only someone who runs the room screen can cast it.' using errcode = '42501';
  end if;
  delete from public.live_casts where expires_at < now();
  t := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.live_casts (token, org_id, meeting_date) values (t, p_org, p_date);
  return t;
end $$;
revoke execute on function public.live_cast_start(uuid, date) from public;
grant execute on function public.live_cast_start(uuid, date) to authenticated;

-- Ends every cast link for the night, for when a link went somewhere it shouldn't.
create or replace function public.live_cast_stop(p_org uuid, p_date date)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.has_role(p_org, array['scorekeeper','leader','owner']::public.membership_role[]) then
    raise exception 'Only someone who runs the room screen can stop casting it.' using errcode = '42501';
  end if;
  delete from public.live_casts where org_id = p_org and meeting_date = p_date;
end $$;
revoke execute on function public.live_cast_stop(uuid, date) from public;
grant execute on function public.live_cast_stop(uuid, date) to authenticated;

-- What a cast device reads, about once a second: the room and the
-- ministry's name, or null once the link is stopped or expired.
create or replace function public.live_cast_room(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'night', c.meeting_date,
    'ministry', coalesce(nullif(o.config->>'ministryName', ''), o.name),
    'room', r.state
  )
  from public.live_casts c
  join public.organizations o on o.id = c.org_id
  left join public.live_rooms r on r.org_id = c.org_id and r.meeting_date = c.meeting_date
  where c.token = p_token and c.expires_at > now()
$$;
grant execute on function public.live_cast_room(text) to anon, authenticated;
