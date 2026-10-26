-- Planning Center, connected per ministry. The OAuth tokens are the
-- church's keys to its own people database, so no client ever reads them:
-- the table has no policies, and only the server (service role) touches it.
-- Leaders see whether it's connected, to what, and since when; coaches, who
-- take attendance, see only whether it's connected.

create table public.pco_connections (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text not null default '',
  pco_org_name text not null default '',
  connected_by uuid,
  connected_at timestamptz not null default now()
);
alter table public.pco_connections enable row level security;

create or replace function public.pco_status(p_org uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case
    when public.has_role(p_org, array['leader','owner']::public.membership_role[]) then
      coalesce((select jsonb_build_object('connected', true, 'org', c.pco_org_name, 'at', c.connected_at, 'scope', c.scope)
                from public.pco_connections c where c.org_id = p_org),
               jsonb_build_object('connected', false))
    when public.has_role(p_org, array['coach']::public.membership_role[]) then
      jsonb_build_object('connected', exists (select 1 from public.pco_connections c where c.org_id = p_org))
  end
$$;
revoke execute on function public.pco_status(uuid) from public;
grant execute on function public.pco_status(uuid) to authenticated;

-- A check-in pulled from Planning Center Check-Ins is its own kind.
alter table public.attendance drop constraint if exists attendance_via_check;
alter table public.attendance add constraint attendance_via_check check (via in ('qr', 'leader', 'pco'));
