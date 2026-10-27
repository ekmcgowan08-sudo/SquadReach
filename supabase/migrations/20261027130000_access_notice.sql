-- Who decided an access request, and who hears about a new one.
--
-- decided_by keeps the deciding leader's name on the request, so the
-- console can say "Approved as Coach by Pastor Mike · Oct 27, 3:15 PM"
-- without reading the audit log back. access_notice_emails is what the
-- server reads (with the service role) to email a ministry's leaders and
-- owners when someone asks to join — nobody else can call it.
alter table public.access_requests add column if not exists decided_by text;

create or replace function public.decide_access(p_request uuid, p_approve boolean, p_role public.membership_role default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.access_requests;
  v_role public.membership_role;
  v_me uuid;
begin
  select * into r from public.access_requests where id = p_request for update;
  if r.id is null then raise exception 'no such request'; end if;
  if not public.has_role(r.org_id, array['leader','owner']::public.membership_role[]) then
    raise exception 'only a ministry leader can decide access';
  end if;
  if r.status <> 'pending' then return; end if;
  v_role := coalesce(p_role, r.requested_role);
  if p_approve and v_role = 'owner' and not public.has_role(r.org_id, array['owner']::public.membership_role[]) then
    raise exception 'only an owner can make someone an owner';
  end if;
  v_me := public.my_membership(r.org_id);
  update public.access_requests set status = case when p_approve then 'approved' else 'denied' end::public.access_status,
    granted_role = case when p_approve then v_role end, decided_at = now(),
    decided_by = (select display_name from public.memberships where id = v_me)
    where id = r.id;
  if p_approve then
    insert into public.memberships (org_id, user_id, role, display_name, student_name)
      values (r.org_id, r.user_id, v_role, r.name,
              case when v_role in ('member', 'captain') then r.name end)
      on conflict (org_id, user_id, role) do nothing;
  end if;
  insert into public.activity_log (org_id, actor, line)
    values (r.org_id, v_me,
            case when not p_approve then 'Denied ' || r.name || ' as ' || r.requested_role
                 when v_role <> r.requested_role then 'Approved ' || r.name || ' as ' || v_role || ' (asked for ' || r.requested_role || ')'
                 else 'Approved ' || r.name || ' as ' || v_role end);
end $$;
grant execute on function public.decide_access(uuid, boolean, public.membership_role) to authenticated;

-- The request, its ministry, and every leader and owner with an email on
-- file: one row per recipient. Service role only.
create or replace function public.access_notice_emails(p_request uuid)
returns table (ministry text, invite_code text, name text, email text, requested_role public.membership_role, note text, to_name text, to_email text)
language sql stable security definer set search_path = public, auth as $$
  select distinct on (u.email) o.name, o.invite_code, r.name, r.email, r.requested_role, r.note, m.display_name, u.email
  from public.access_requests r
  join public.organizations o on o.id = r.org_id
  join public.memberships m on m.org_id = r.org_id and m.role in ('leader', 'owner')
  join auth.users u on u.id = m.user_id
  where r.id = p_request and r.status = 'pending' and u.email is not null and u.email <> ''
  order by u.email, m.created_at
$$;
revoke execute on function public.access_notice_emails(uuid) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.access_notice_emails(uuid) to service_role;
  end if;
end $$;
