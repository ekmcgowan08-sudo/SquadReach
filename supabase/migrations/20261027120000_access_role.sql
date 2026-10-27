-- Change & approve. A leader can approve an access request as the role
-- the person asked for, or as the one that fits what they actually do.
-- Only an owner can make someone an owner. The role granted is kept on
-- the request and written to the audit log.
alter table public.access_requests add column if not exists granted_role public.membership_role;

drop function if exists public.decide_access(uuid, boolean);
create or replace function public.decide_access(p_request uuid, p_approve boolean, p_role public.membership_role default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.access_requests;
  v_role public.membership_role;
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
  update public.access_requests set status = case when p_approve then 'approved' else 'denied' end::public.access_status,
    granted_role = case when p_approve then v_role end, decided_at = now() where id = r.id;
  if p_approve then
    insert into public.memberships (org_id, user_id, role, display_name, student_name)
      values (r.org_id, r.user_id, v_role, r.name,
              case when v_role in ('member', 'captain') then r.name end)
      on conflict (org_id, user_id, role) do nothing;
  end if;
  insert into public.activity_log (org_id, actor, line)
    values (r.org_id, public.my_membership(r.org_id),
            case when not p_approve then 'Denied ' || r.name || ' as ' || r.requested_role
                 when v_role <> r.requested_role then 'Approved ' || r.name || ' as ' || v_role || ' (asked for ' || r.requested_role || ')'
                 else 'Approved ' || r.name || ' as ' || v_role end);
end $$;
grant execute on function public.decide_access(uuid, boolean, public.membership_role) to authenticated;
