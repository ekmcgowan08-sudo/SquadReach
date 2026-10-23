-- The week around the night. Runs after rls.test.sql, on the same ministry:
-- Pastor Mike (owner), Coach Chris (coach), Sam Okafor (scorekeeper),
-- Ellison Reid (member, on the Yellow roster), an outsider, Luke (captain).
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
update organizations set config = config || jsonb_build_object('meetingDates', jsonb_build_array(current_date::text, (current_date + 7)::text, (current_date - 7)::text)) where id = :'org';

select pg_temp.check((select student_name from memberships where org_id = :'org' and display_name = 'Ellison Reid') = 'Ellison Reid', 'an approved student is linked to their roster name');

-- ── self check-in ───────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check(public.self_check_in(:'org', current_date), 'a student checks themselves in tonight');
select pg_temp.check((select via from attendance where org_id = :'org' and student_id = :'stu' and meeting_date = current_date) = 'qr', 'and it is recorded as the door');
select pg_temp.denied(format('select public.self_check_in(%L, %L)', :'org', (current_date + 7)::text), 'but not for next week');
select pg_temp.denied(format('select public.self_check_in(%L, %L)', :'org', (current_date + 1)::text), 'and not on a night that is not a meeting');
select pg_temp.denied(format('insert into attendance (org_id, meeting_date, student_id, present) values (%L, %L, %L, true)', :'org', (current_date - 7)::text, :'stu'), 'nor write attendance rows directly');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.denied(format('select public.self_check_in(%L, current_date)', :'org'), 'a scorekeeper has no student row to check in');

-- ── reminders, follow-ups, notes, pickup, the door ─────────────────────
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
insert into night_reminders (org_id, meeting_date, reminder_id, off) values (:'org', current_date, 'r1', true);
insert into night_pickup (org_id, meeting_date, shift_min) values (:'org', current_date, 10);
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from night_reminders where org_id = :'org') = 1, 'a scorekeeper reads the reminders');
select pg_temp.denied(format('insert into night_reminders (org_id, meeting_date, reminder_id, sent_at) values (%L, current_date, %L, now())', :'org', 'r3'), 'but cannot post one');
select pg_temp.check((select count(*) from night_followups) = 0, 'and cannot see follow-ups');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
insert into night_followups (org_id, meeting_date, item_id, done, done_by) values (:'org', current_date, 'm-Wyatt Price', true, 'Coach Chris');
insert into night_notes (org_id, meeting_date, went_well) values (:'org', current_date, 'The relay');
insert into door_flags (org_id, meeting_date, name) values (:'org', current_date, 'Kai Bennett');
select pg_temp.check((select count(*) from night_followups) = 1 and (select count(*) from door_flags) = 1, 'a coach works follow-ups, notes and the door');
update night_pickup set shift_min = 30 where org_id = :'org';
select pg_temp.check((select shift_min from night_pickup where org_id = :'org') = 10, 'pickup is a leader''s call: a coach''s change does nothing');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check((select count(*) from night_followups) + (select count(*) from night_notes) + (select count(*) from door_flags) + (select count(*) from night_reminders) = 0, 'a student sees none of it');

-- ── serving ────────────────────────────────────────────────────────────
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
insert into serve_schedule (org_id, meeting_date, role, name) values (:'org', current_date + 7, 'Game lead', 'Sam Okafor');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
insert into serve_availability (org_id, name, meeting_date, state) values (:'org', 'Sam Okafor', current_date + 7, 'no');
select pg_temp.denied(format('insert into serve_availability (org_id, name, meeting_date, state) values (%L, %L, current_date + 7, %L)', :'org', 'Coach Chris', 'no'), 'a volunteer sets only their own availability');
insert into serve_swaps (org_id, from_name, meeting_date, role, why) values (:'org', 'Sam Okafor', current_date + 7, 'Game lead', 'Wedding');
select pg_temp.denied(format('insert into serve_swaps (org_id, from_name, meeting_date, role) values (%L, %L, current_date + 7, %L)', :'org', 'Coach Chris', 'Worship'), 'asks for swaps only as themselves');
select pg_temp.denied(format('insert into serve_swaps (org_id, from_name, meeting_date, role, status) values (%L, %L, current_date + 7, %L, %L)', :'org', 'Sam Okafor', 'Worship', 'approved'), 'and cannot file one already approved');
update serve_swaps set status = 'approved' where org_id = :'org';
select pg_temp.check((select status from serve_swaps where org_id = :'org') = 'pending', 'nor approve their own');
update serve_schedule set name = 'Nobody' where org_id = :'org';
select pg_temp.check((select name from serve_schedule where org_id = :'org') = 'Sam Okafor', 'nor change the schedule');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
update serve_swaps set status = 'approved', to_name = 'Coach Chris', decided_by = 'Pastor Mike' where org_id = :'org';
update serve_schedule set name = 'Coach Chris' where org_id = :'org' and role = 'Game lead';
select pg_temp.check((select name from serve_schedule where org_id = :'org') = 'Coach Chris', 'the coordinator approves the swap and the schedule follows');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check((select count(*) from serve_schedule) + (select count(*) from serve_swaps) = 0, 'students don''t see the volunteer schedule');

-- ── families ───────────────────────────────────────────────────────────
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
insert into families (org_id, student_id, guardian, contact, token) values (:'org', :'stu', 'Dana Reid', '(417) 555-0187', 'tok-ellison-0123456789');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from families) = 0, 'a scorekeeper never sees guardian contact');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check((select count(*) from families) = 0, 'nor does a student');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
insert into permission_slips (id, org_id, title, due, kids) values ('11111111-1111-1111-1111-111111111111', :'org', 'Van ride', (current_date)::text || 'T18:00', '["Ellison Reid"]');
insert into permission_slips (id, org_id, title, due, kids) values ('22222222-2222-2222-2222-222222222222', :'org', 'Someone else''s trip', (current_date + 3)::text, '["Luke Jarvis"]');
select id as mem from memberships where org_id = :'org' and role = 'owner' \gset
insert into parent_messages (id, org_id, author, from_name, audience, kids, body) values ('33333333-3333-3333-3333-333333333333', :'org', :'mem', 'Pastor Mike', 'all', '["Ellison Reid", "Luke Jarvis"]', 'Retreat sign-ups are open');
insert into parent_messages (id, org_id, author, from_name, audience, kids, body) values ('44444444-4444-4444-4444-444444444444', :'org', :'mem', 'Pastor Mike', 'Luke Jarvis', '["Luke Jarvis"]', 'Just for Luke''s family');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.denied(format('insert into parent_messages (org_id, author, audience, body) values (%L, %L, %L, %L)', :'org', :'mem', 'all', 'hi'), 'a coach cannot message families');

reset role;
set role anon;
select pg_temp.check((public.family_view('tok-ellison-0123456789'))->'kid'->>'name' = 'Ellison Reid', 'the family link opens without signing in');
select pg_temp.check((public.family_view('tok-ellison-0123456789'))->>'present' = 'true', 'and shows tonight''s check-in');
select pg_temp.check(jsonb_array_length((public.family_view('tok-ellison-0123456789'))->'slips') = 1, 'only their own slips');
select pg_temp.check(jsonb_array_length((public.family_view('tok-ellison-0123456789'))->'msgs') = 1, 'only messages that reached them');
select pg_temp.check(position('555' in (public.family_view('tok-ellison-0123456789'))::text) = 0, 'and never a phone number');
select pg_temp.check((public.family_view('tok-ellison-0123456789'))->'night'->>'pickupShift' = '10', 'with tonight''s pickup');
select pg_temp.check(public.family_view('wrong-token-0000000000') is null and public.family_view('short') is null, 'a wrong token opens nothing');
select pg_temp.check(public.family_sign('tok-ellison-0123456789', '11111111-1111-1111-1111-111111111111'), 'a family signs their slip');
select pg_temp.denied($$select public.family_sign('tok-ellison-0123456789', '22222222-2222-2222-2222-222222222222')$$, 'but not another family''s');
select pg_temp.check(public.family_read('tok-ellison-0123456789', '33333333-3333-3333-3333-333333333333'), 'and marks a message read');
select pg_temp.denied($$select public.family_read('tok-ellison-0123456789', '44444444-4444-4444-4444-444444444444')$$, 'but not someone else''s');
select pg_temp.denied('select count(*) from families', 'the anonymous role reads no tables');
reset role;
select pg_temp.check((select signed_by from slip_signatures where slip_id = '11111111-1111-1111-1111-111111111111') = 'Dana Reid', 'the signature carries the guardian''s name');

-- An outsider sees none of it.
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from serve_schedule) + (select count(*) from families) + (select count(*) from parent_messages) + (select count(*) from night_followups) + (select count(*) from permission_slips) = 0, 'an outsider reads none of the week');

reset role;
\echo 'ALL NIGHT-CYCLE TESTS PASSED'
