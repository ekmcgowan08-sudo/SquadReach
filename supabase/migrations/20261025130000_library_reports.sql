-- Reports on shared library units. Nobody reviews a unit before other
-- ministries read it, so the ministries reading it are the review: a
-- ministry's leaders can report another ministry's unit, which hides it
-- from that ministry at once, and once two ministries have reported it,
-- from every ministry but the one that shared it. That ministry sees why —
-- not who — and a changed unit starts over with no reports.

create table public.library_reports (
  unit_id uuid not null references public.library_units(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  reason text not null check (reason in ('names', 'unsuitable', 'wrong', 'other')),
  note text not null default '' check (length(note) <= 300),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (unit_id, org_id)
);
alter table public.library_reports enable row level security;

-- A ministry's leaders report a unit someone else shared, once.
create policy library_reports_insert on public.library_reports for insert with check (
  public.has_role(org_id, array['leader','owner']::public.membership_role[])
  and exists (select 1 from public.library_units u where u.id = unit_id and u.shared and u.org_id <> library_reports.org_id)
);
-- Each ministry reads only its own reports.
create policy library_reports_read on public.library_reports for select using (public.is_member(org_id));

-- Hidden from this person: their ministry reported it, or two ministries did.
create or replace function public.library_hidden(p_unit uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (select count(*) from public.library_reports r where r.unit_id = p_unit) >= 2
    or exists (select 1 from public.library_reports r where r.unit_id = p_unit and public.is_member(r.org_id))
$$;
grant execute on function public.library_hidden(uuid) to authenticated;

drop policy if exists library_read on public.library_units;
create policy library_read on public.library_units for select using (
  public.is_member(org_id) or (shared and auth.uid() is not null and not public.library_hidden(id))
);

-- What the sharing ministry's leaders see about their own units: each
-- report's reason and note, never which ministry made it.
create or replace function public.library_flags(p_org uuid)
returns table (unit_id uuid, reason text, note text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.unit_id, r.reason, r.note, r.created_at
  from public.library_reports r
  join public.library_units u on u.id = r.unit_id
  where u.org_id = p_org and public.has_role(p_org, array['leader','owner']::public.membership_role[])
  order by r.created_at
$$;
grant execute on function public.library_flags(uuid) to authenticated;

-- A unit that changes starts over.
create or replace function public.library_units_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.title, new.summary, new.span, new.theme, new.includes, new.pts)
     is distinct from (old.title, old.summary, old.span, old.theme, old.includes, old.pts) then
    delete from public.library_reports where unit_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists library_units_changed on public.library_units;
create trigger library_units_changed after update on public.library_units
  for each row execute function public.library_units_changed();
