-- Forms that block, the trips they gate, and camp money (lib/forms.ts).
--
-- A permission slip now has a kind. Medical & allergies, emergency contact,
-- general permission and trip waivers block; a photo release only warns. A
-- slip can belong to one trip (its waiver) or stand for every trip.
-- A blocked student still takes part on a normal night — the block gates
-- trips: they can't answer "going" to a trip until a parent signs.
-- Camp money is tracking only (no card handling): a coach or leader marks a
-- payment at the door, and it stays unconfirmed until a leader counts it.
alter table public.permission_slips
  add column if not exists kind text not null default 'permission'
    check (kind in ('medical', 'emergency', 'permission', 'waiver', 'photo')),
  add column if not exists event_id uuid references public.events(id) on delete set null;

alter table public.events
  add column if not exists trip boolean not null default false,
  add column if not exists cost numeric(8, 2) check (cost is null or cost >= 0);

-- The blocking forms a student hasn't got signed, for one trip.
create or replace function public.trip_blockers(p_org uuid, p_event uuid, p_student text)
returns table (title text, kind text)
language sql stable security definer set search_path = public as $$
  select s.title, s.kind
  from public.permission_slips s
  join public.students st on st.org_id = p_org and lower(st.name) = lower(p_student)
  where s.org_id = p_org
    and s.kind in ('medical', 'emergency', 'permission', 'waiver')
    and (s.event_id is null or s.event_id = p_event)
    and (s.kids is null or s.kids ? st.name)
    and not exists (select 1 from public.slip_signatures g where g.slip_id = s.id and g.student_id = st.id)
$$;
grant execute on function public.trip_blockers(uuid, uuid, text) to authenticated;

create or replace function public.rsvp_trip_gate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_student text;
  v_missing text;
begin
  if new.status <> 'going' then return new; end if;
  if not exists (select 1 from public.events e where e.id = new.event_id and e.trip) then return new; end if;
  select student_name into v_student from public.memberships where id = new.membership_id;
  if v_student is null then return new; end if;
  select string_agg(b.title, ', ') into v_missing from public.trip_blockers(new.org_id, new.event_id, v_student) b;
  if v_missing is not null then
    raise exception 'forms not signed yet: %', v_missing;
  end if;
  return new;
end $$;
drop trigger if exists rsvp_trip_gate on public.rsvps;
create trigger rsvp_trip_gate before insert or update on public.rsvps for each row execute function public.rsvp_trip_gate();

create table public.camp_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  student text not null check (length(student) between 1 and 120),
  amount numeric(8, 2) not null check (amount > 0 and amount <= 10000),
  by_name text not null default '',
  created_at timestamptz not null default now(),
  confirmed_by text,
  confirmed_at timestamptz
);
create index camp_payments_event on public.camp_payments (org_id, event_id);
alter table public.camp_payments enable row level security;

create or replace function public.camp_payment_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.by_name := coalesce((select display_name from public.memberships where id = public.my_membership(new.org_id)), '');
  new.created_at := now();
  new.confirmed_by := null;
  new.confirmed_at := null;
  return new;
end $$;
create trigger camp_payment_stamp before insert on public.camp_payments for each row execute function public.camp_payment_stamp();

create policy camp_pay_read on public.camp_payments for select
  using (public.has_role(org_id, array['coach','leader','owner']::public.membership_role[]));
create policy camp_pay_mark on public.camp_payments for insert
  with check (public.has_role(org_id, array['coach','leader','owner']::public.membership_role[]));
-- A mistake can come off before the office counts it, and only then.
create policy camp_pay_undo on public.camp_payments for delete
  using (confirmed_at is null and public.has_role(org_id, array['leader','owner']::public.membership_role[]));

-- The office counts it: a leader confirms, and the payment keeps who did.
create or replace function public.camp_payment_confirm(p_payment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.camp_payments;
begin
  select * into p from public.camp_payments where id = p_payment for update;
  if p.id is null then raise exception 'no such payment'; end if;
  if not public.has_role(p.org_id, array['leader','owner']::public.membership_role[]) then
    raise exception 'only a ministry leader can count a payment';
  end if;
  if p.confirmed_at is not null then return; end if;
  update public.camp_payments set confirmed_at = now(),
    confirmed_by = (select display_name from public.memberships where id = public.my_membership(p.org_id))
    where id = p.id;
end $$;
grant execute on function public.camp_payment_confirm(uuid) to authenticated;

-- The family link says what each form is, so a parent knows which ones hold
-- up a trip. family_view as before, with each slip's kind.
create or replace function public.family_view(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  f public.families;
  s public.students;
  o public.organizations;
  t public.teams;
  v_tonight date;
  v_huddle jsonb;
begin
  if p_token is null or length(p_token) < 16 then return null; end if;
  select * into f from public.families where token = p_token;
  if f.student_id is null then return null; end if;
  select * into s from public.students where id = f.student_id;
  select * into o from public.organizations where id = f.org_id;
  select * into t from public.teams where id = s.team_id;
  select coalesce(
           (select min(d::date) from jsonb_array_elements_text(coalesce(o.config->'meetingDates', '[]'::jsonb)) d where d::date >= current_date),
           (select max(d::date) from jsonb_array_elements_text(coalesce(o.config->'meetingDates', '[]'::jsonb)) d))
    into v_tonight;
  select n.huddle into v_huddle from public.nights n where n.org_id = o.id and n.meeting_date = v_tonight;
  return jsonb_build_object(
    'ministry', o.name,
    'cycle', o.config->'cycle',
    'meetingDates', coalesce(o.config->'meetingDates', '[]'::jsonb),
    'gameName', coalesce(o.config->>'gameName', ''),
    'venueAddress', coalesce(o.config->>'venueAddress', ''),
    'kid', jsonb_build_object('name', s.name, 'team', t.name, 'teamColor', t.color),
    'guardian', f.guardian,
    -- Coaches' names and jobs only, so the card can say who leads their group.
    'crew', coalesce((select jsonb_agg(jsonb_build_object('name', c->>'name', 'job', c->>'job', 'team', case when c->>'team' = s.team_id::text then t.name end))
                      from jsonb_array_elements(coalesce(v_huddle->'crew', '[]'::jsonb)) c
                      where c->>'team' = s.team_id::text), '[]'::jsonb),
    -- Times and block names only: never the staff notes.
    'runSheet', coalesce((select jsonb_agg(jsonb_build_object('time', r->>'time', 'label', r->>'label', 'debrief', coalesce((r->>'debrief')::boolean, false)))
                          from jsonb_array_elements(coalesce(v_huddle->'runSheet', '[]'::jsonb)) r), '[]'::jsonb),
    'tonight', v_tonight,
    'present', exists (select 1 from public.attendance a where a.org_id = o.id and a.meeting_date = v_tonight and a.student_id = s.id and a.present),
    'via', (select a.via from public.attendance a where a.org_id = o.id and a.meeting_date = v_tonight and a.student_id = s.id and a.present),
    'presentDates', coalesce((select jsonb_agg(a.meeting_date order by a.meeting_date) from public.attendance a
                              where a.org_id = o.id and a.student_id = s.id and a.present and a.meeting_date < v_tonight), '[]'::jsonb),
    'night', jsonb_build_object(
      'pickupShift', coalesce((select p.shift_min from public.night_pickup p where p.org_id = o.id and p.meeting_date = v_tonight), 0),
      'rem', coalesce((select jsonb_object_agg(r.reminder_id, jsonb_strip_nulls(jsonb_build_object('off', r.off, 'sentAt', (extract(epoch from r.sent_at) * 1000)::bigint, 'text', r.body)))
                       from public.night_reminders r where r.org_id = o.id and r.meeting_date = v_tonight), '{}'::jsonb)),
    'slips', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'due', p.due, 'kind', p.kind) order by p.due)
                       from public.permission_slips p
                       where p.org_id = o.id and (p.kids is null or p.kids ? s.name)), '[]'::jsonb),
    'signed', coalesce((select jsonb_agg(jsonb_build_object('slip', g.slip_id, 'by', g.signed_by))
                        from public.slip_signatures g where g.student_id = s.id), '[]'::jsonb),
    'msgs', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'from', m.from_name, 'text', m.body, 'at', (extract(epoch from m.created_at) * 1000)::bigint,
                                                         'read', exists (select 1 from public.parent_message_reads x where x.message_id = m.id and x.student_id = s.id))
                                      order by m.created_at desc)
                      from (select * from public.parent_messages pm where pm.org_id = o.id and pm.kids ? s.name order by pm.created_at desc limit 30) m), '[]'::jsonb)
  );
end $$;
