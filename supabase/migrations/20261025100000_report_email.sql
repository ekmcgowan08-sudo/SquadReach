-- Report delivery by email. A scheduled job (app/api/cron/deliveries) and
-- the console's "Send now" claim each (delivery, period) here before
-- sending, so a retry or a second runner can never send it twice. Only the
-- server writes these rows; leaders read them to see what went out.

create table public.report_sends (
  org_id uuid not null references public.organizations(id) on delete cascade,
  delivery_id text not null check (length(delivery_id) between 1 and 80),
  period text not null check (length(period) between 1 and 80),
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  sent integer not null default 0,
  missing text[] not null default '{}',
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed', 'skipped')),
  error text check (length(error) <= 500),
  by_name text not null default 'Schedule',
  primary key (org_id, delivery_id, period)
);
alter table public.report_sends enable row level security;
create policy report_sends_read on public.report_sends for select
  using (public.has_role(org_id, array['leader','owner']::public.membership_role[]));
-- No write policies: only the service role (which bypasses RLS) records sends.

-- Recipients are worked out as names (the crew, captains, leaders). This
-- finds the email on file for each name that belongs to someone in the
-- ministry. The server alone may ask.
create or replace function public.delivery_emails(p_org uuid, p_names text[])
returns table (name text, email text)
language sql stable security definer set search_path = public, auth as $$
  select distinct on (lower(trim(n))) trim(n), u.email
  from unnest(p_names) n
  join public.memberships m
    on m.org_id = p_org
   and (lower(trim(m.display_name)) = lower(trim(n)) or lower(trim(coalesce(m.student_name, ''))) = lower(trim(n)))
  join auth.users u on u.id = m.user_id
  where u.email is not null and u.email <> ''
  order by lower(trim(n)), m.created_at
$$;
revoke execute on function public.delivery_emails(uuid, text[]) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.delivery_emails(uuid, text[]) to service_role;
  end if;
end $$;
