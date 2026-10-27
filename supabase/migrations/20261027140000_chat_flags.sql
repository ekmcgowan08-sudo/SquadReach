-- Flag a chat thread for a leader. Anyone who can read a thread can flag
-- it, and the flag carries their name (stamped here, not trusted from the
-- phone). Leaders and owners see every flag and can read a flagged thread
-- they otherwise couldn't — an adult-only direct message — from then on;
-- they still can't post in it. The person who flagged sees their own flags.
create table public.chat_flags (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  thread_id text not null,
  thread_name text not null default '',
  flagged_by uuid references public.memberships(id) on delete set null,
  by_name text not null default '',
  created_at timestamptz not null default now(),
  seen_by text,
  seen_at timestamptz
);
create index chat_flags_thread on public.chat_flags (org_id, thread_id);
alter table public.chat_flags enable row level security;

create or replace function public.chat_flag_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.flagged_by := public.my_membership(new.org_id);
  new.by_name := coalesce((select display_name from public.memberships where id = new.flagged_by), '');
  new.created_at := now();
  new.seen_by := null;
  new.seen_at := null;
  return new;
end $$;
create trigger chat_flag_stamp before insert on public.chat_flags for each row execute function public.chat_flag_stamp();

create policy chat_flag_file on public.chat_flags for insert
  with check (flagged_by is not null and public.chat_can(org_id, thread_id, false));
create policy chat_flag_read on public.chat_flags for select
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]) or flagged_by = public.my_membership(org_id));

-- A leader marks a flag seen, and the flag keeps who did. Nothing else
-- about a flag changes, and nobody deletes one.
create or replace function public.chat_flag_seen(p_flag uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  f public.chat_flags;
begin
  select * into f from public.chat_flags where id = p_flag for update;
  if f.id is null then raise exception 'no such flag'; end if;
  if not public.has_role(f.org_id, array['leader','owner']::public.membership_role[]) then
    raise exception 'only a ministry leader can clear a flag';
  end if;
  if f.seen_at is not null then return; end if;
  update public.chat_flags set seen_at = now(),
    seen_by = (select display_name from public.memberships where id = public.my_membership(f.org_id))
    where id = f.id;
end $$;
grant execute on function public.chat_flag_seen(uuid) to authenticated;

-- chat_can, as before, plus: a leader reads (never posts in) a flagged thread.
create or replace function public.chat_can(org uuid, thread text, posting boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select (case
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
  end)
  or (not posting
      and public.has_role(org, array['leader','owner']::public.membership_role[])
      and exists (select 1 from public.chat_flags f where f.org_id = org and f.thread_id = thread));
$$;
grant execute on function public.chat_can(uuid, text, boolean) to authenticated;
