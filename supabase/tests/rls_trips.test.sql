-- Forms that block, the trips they gate, and camp money. Runs after the
-- other tests, on the same ministry: Ellison Reid (user 4) is a student.
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.check(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
create or replace function pg_temp.denied(stmt text, msg text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAILED: %', msg;
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - %', msg;
end $$;
set client_min_messages = notice;

reset role;
select id as org from organizations where name = 'Grace Community Students' \gset
select id as stu from students where org_id = :'org' and name = 'Ellison Reid' \gset
select id as m_student from memberships where org_id = :'org' and user_id = '00000000-0000-0000-0000-000000000004' order by created_at limit 1 \gset
update memberships set student_name = 'Ellison Reid' where id = :'m_student';

select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
insert into events (org_id, title, trip, cost) values (:'org', 'Winter camp', true, 120) returning id as camp \gset
insert into events (org_id, title) values (:'org', 'Bowling night') returning id as bowl \gset
insert into permission_slips (org_id, title, due, kind) values (:'org', 'Medical & allergies 2026', '2026-12-01', 'medical') returning id as med \gset
insert into permission_slips (org_id, title, due, kind) values (:'org', 'Photo release', '2026-12-01', 'photo');
insert into permission_slips (org_id, title, due, kind, event_id) values (:'org', 'Winter camp waiver', '2026-12-01', 'waiver', :'camp') returning id as waiver \gset
select pg_temp.denied(format('insert into permission_slips (org_id, title, due, kind) values (%L, %L, %L, %L)', :'org', 'Bad', '2026-12-01', 'whatever'), 'a form has one of the known kinds');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.denied(format('insert into rsvps (event_id, org_id, membership_id, name, status) values (%L, %L, %L, %L, %L)', :'camp', :'org', :'m_student', 'Ellison Reid', 'going'), 'a student with an unsigned medical form can''t sign up for a trip');
insert into rsvps (event_id, org_id, membership_id, name, status) values (:'camp', :'org', :'m_student', 'Ellison Reid', 'maybe');
select pg_temp.check((select status from rsvps where event_id = :'camp') = 'maybe', 'but can say maybe');
insert into rsvps (event_id, org_id, membership_id, name, status) values (:'bowl', :'org', :'m_student', 'Ellison Reid', 'going');
select pg_temp.check((select status from rsvps where event_id = :'bowl') = 'going', 'and a normal night is never gated');
select pg_temp.check((select count(*) from public.trip_blockers(:'org', :'camp', 'Ellison Reid')) = 2, 'the medical form and the camp''s own waiver are what''s missing');
select pg_temp.check((select count(*) from public.trip_blockers(:'org', :'bowl', 'Ellison Reid')) = 1, 'another event isn''t held up by the camp''s waiver');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
insert into slip_signatures (slip_id, student_id, org_id, signed_by) values (:'med', :'stu', :'org', 'Paper slip · Pastor Mike'), (:'waiver', :'stu', :'org', 'Paper slip · Pastor Mike');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
update rsvps set status = 'going' where event_id = :'camp' and membership_id = :'m_student';
select pg_temp.check((select status from rsvps where event_id = :'camp') = 'going', 'once both are signed they can go — the photo release only warns');
reset role;

-- Camp money: a coach marks it at the door, the office counts it.
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
insert into camp_payments (org_id, event_id, student, amount, by_name, confirmed_at) values (:'org', :'camp', 'Ellison Reid', 60, 'Somebody', now());
select pg_temp.check((select by_name from camp_payments) = 'Coach Chris' and (select confirmed_at from camp_payments) is null, 'a coach marks a payment, under their own name, unconfirmed');
select pg_temp.denied(format('select public.camp_payment_confirm(%L)', (select id from camp_payments limit 1)), 'but can''t count it');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.denied(format('insert into camp_payments (org_id, event_id, student, amount) values (%L, %L, %L, %L)', :'org', :'camp', 'Ellison Reid', 10), 'a scorekeeper doesn''t handle money');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check((select count(*) from camp_payments) = 0, 'a student sees no one''s payments');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
insert into camp_payments (org_id, event_id, student, amount) values (:'org', :'camp', 'Ellison Reid', 5);
delete from camp_payments where amount = 5;
select pg_temp.check((select count(*) from camp_payments) = 1, 'a leader can take back a mistake before it''s counted');
select public.camp_payment_confirm((select id from camp_payments limit 1));
select pg_temp.check((select confirmed_by from camp_payments) = 'Pastor Mike', 'the office counts it, and the payment keeps who did');
delete from camp_payments;
select pg_temp.check((select count(*) from camp_payments) = 1, 'and a counted payment can''t be removed');
reset role;
