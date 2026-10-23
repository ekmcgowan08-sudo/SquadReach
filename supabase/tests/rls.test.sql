-- RLS and rule tests. Run with supabase/tests/run.sh. Any failed assertion
-- raises and stops the script with a non-zero exit.
\set ON_ERROR_STOP on
set client_min_messages = warning;
\pset tuples_only on
\pset format unaligned

insert into auth.users values
  ('00000000-0000-0000-0000-000000000001', 'pastor@example.org'),
  ('00000000-0000-0000-0000-000000000002', 'coach@example.org'),
  ('00000000-0000-0000-0000-000000000003', 'scorer@example.org'),
  ('00000000-0000-0000-0000-000000000004', 'student@example.org'),
  ('00000000-0000-0000-0000-000000000005', 'outsider@example.org'),
  ('00000000-0000-0000-0000-000000000006', 'captain@example.org');

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
set client_min_messages = notice;

-- The pastor starts a ministry.
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.create_ministry('Grace Community Students', 'Pastor Mike') as org \gset
select pg_temp.check((select count(*) from teams where org_id = :'org') = 4, 'create_ministry makes four squads');
select pg_temp.check((select count(*) from categories where org_id = :'org') = 7, 'and seven categories');
select pg_temp.check(public.has_role(:'org', array['owner']::membership_role[]), 'the creator is the owner');
select id as yellow from teams where org_id = :'org' and name = 'Yellow' \gset
select invite_code as code from organizations where id = :'org' \gset

-- A coach, a scorekeeper, a student and a captain ask to join; the pastor approves.
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select public.request_access(:'code', 'coach', 'Coach Chris') as req_coach \gset
select pg_temp.check((select count(*) from memberships) = 0, 'a requester holds no membership yet');
do $$ begin
  perform public.request_access((select invite_code from organizations limit 1), 'owner', 'Sneaky', '');
  raise exception 'FAILED: owner was requestable';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - nobody can request owner';
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select public.request_access(:'code', 'scorekeeper', 'Sam Okafor') as req_scorer \gset
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select public.request_access(:'code', 'member', 'Ellison Reid') as req_student \gset
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select public.request_access(:'code', 'captain', 'Luke Jarvis') as req_captain \gset

-- A student cannot approve anyone.
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
do $$ begin
  perform public.decide_access((select id from access_requests where requested_role = 'coach'), true);
  raise exception 'FAILED: a student decided access';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - a student cannot decide access';
end $$;

reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.decide_access(:'req_coach', true);
select public.decide_access(:'req_scorer', true);
select public.decide_access(:'req_student', true);
select public.decide_access(:'req_captain', true);
select pg_temp.check((select count(*) from memberships where org_id = :'org') = 6, 'approvals create memberships');
select pg_temp.check((select count(*) from activity_log where org_id = :'org') = 4, 'each decision writes the audit log');

-- AUTO_APPROVE_ROLES: a scorekeeper's entry posts approved even if it says pending.
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
insert into score_entries (id, org_id, team_id, category_key, amount, reason, status, entered_by_name)
  values ('10000000-0000-0000-0000-000000000001', :'org', :'yellow', 'games', 300, 'won the relay', 'pending', 'Sam');
select pg_temp.check((select status from score_entries where id = '10000000-0000-0000-0000-000000000001') = 'approved', 'scorekeeper entries post approved');

-- A coach's entry lands pending even if it claims approved. Queueing never launders a role.
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
insert into score_entries (id, org_id, team_id, category_key, amount, reason, status, entered_by_name, created_at)
  values ('10000000-0000-0000-0000-000000000002', :'org', :'yellow', 'general', 50, 'attended', 'approved', 'Coach Chris', now() - interval '3 hours');
select pg_temp.check((select status from score_entries where id = '10000000-0000-0000-0000-000000000002') = 'pending', 'coach entries land pending');
select pg_temp.check((select created_at < now() - interval '2 hours' from score_entries where id = '10000000-0000-0000-0000-000000000002'), 'replay keeps the client time');

-- Replaying the same outbox row is a no-op, not a double post.
insert into score_entries (id, org_id, team_id, category_key, amount, reason, entered_by_name)
  values ('10000000-0000-0000-0000-000000000002', :'org', :'yellow', 'general', 50, 'attended', 'Coach Chris')
  on conflict (id) do nothing;
select pg_temp.check((select count(*) from score_entries where id = '10000000-0000-0000-0000-000000000002') = 1, 'replays are idempotent on the client id');

-- A coach cannot approve their own entry, but may withdraw it.
do $$ begin
  update score_entries set status = 'approved' where id = '10000000-0000-0000-0000-000000000002';
  raise exception 'FAILED: a coach approved an entry';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - a coach cannot approve';
end $$;

-- The ledger is append-only.
do $$ begin
  update score_entries set amount = 5000 where id = '10000000-0000-0000-0000-000000000002';
  raise exception 'FAILED: amount was edited';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - amounts cannot be edited';
end $$;
delete from score_entries where id = '10000000-0000-0000-0000-000000000002';
select pg_temp.check((select count(*) from score_entries where id = '10000000-0000-0000-0000-000000000002') = 1, 'nobody deletes from the ledger');

-- A student can read the board but cannot score.
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check((select count(*) from score_entries) = 2, 'a student reads the ledger');
do $$ begin
  insert into score_entries (id, org_id, team_id, category_key, amount, entered_by_name)
    values (gen_random_uuid(), (select id from organizations limit 1), (select id from teams limit 1), 'general', 999, 'me');
  raise exception 'FAILED: a student scored';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - a student cannot score';
end $$;

-- A captain may submit; it queues.
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
insert into score_entries (id, org_id, team_id, category_key, amount, reason, entered_by_name)
  values ('10000000-0000-0000-0000-000000000003', :'org', :'yellow', 'visitors', 800, 'brought a friend', 'Luke');
select pg_temp.check((select status from score_entries where id = '10000000-0000-0000-0000-000000000003') = 'pending', 'a captain submission queues');

-- The pastor approves; a decided entry stays decided.
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
update score_entries set status = 'approved', decided_by_name = 'Pastor Mike' where id = '10000000-0000-0000-0000-000000000002';
select pg_temp.check((select status from score_entries where id = '10000000-0000-0000-0000-000000000002') = 'approved', 'a leader approves');
do $$ begin
  update score_entries set status = 'rejected' where id = '10000000-0000-0000-0000-000000000002';
  raise exception 'FAILED: a decided entry was re-decided';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - a decision is final (undo is a reversal row)';
end $$;

-- Team care is ROSTER_EDIT_ROLES only: the scorekeeper sees none of it.
insert into care_notes (org_id, name, meta, flagged_by) values (:'org', 'Wyatt Price', 'Missed 3 weeks', 'Coach Chris');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from care_notes) = 1, 'a coach reads team care');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from care_notes) = 0, 'the scorekeeper does not');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check((select count(*) from care_notes) = 0, 'nor does a student');

-- Prayer: filing lands queued and invisible to other students until posted.
insert into prayer_requests (org_id, author, who, body)
  values (:'org', public.my_membership(:'org'), 'Ellison Reid', 'My little brother starts chemo Monday.') returning id as prayer \gset
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select pg_temp.check((select count(*) from prayer_requests) = 0, 'a queued request is not on anyone else''s wall');
do $$ begin
  insert into prayer_requests (org_id, who, body, status) values ((select id from organizations limit 1), 'x', 'straight to the wall please', 'wall');
  raise exception 'FAILED: a request skipped the review queue';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - nothing goes straight to the wall';
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from prayer_requests) = 1, 'a leader reads the queue');
update prayer_requests set status = 'wall' where id = :'prayer';
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select pg_temp.check((select count(*) from prayer_requests) = 1, 'once posted, it is on the wall');
select pg_temp.check(public.set_praying(:'prayer', true) = 1, 'praying counts once per person');
select pg_temp.check(public.set_praying(:'prayer', true) = 1, 'and tapping again does not double it');

-- Attendance is roster data: a coach writes it, a scorekeeper cannot.
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
insert into students (org_id, team_id, name, grade) values (:'org', :'yellow', 'Ellison Reid', '8') returning id as stu \gset
insert into attendance (org_id, meeting_date, student_id) values (:'org', '2026-10-28', :'stu');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
do $$ begin
  insert into attendance (org_id, meeting_date, student_id) values ((select id from organizations limit 1), '2026-10-29', (select id from students limit 1));
  raise exception 'FAILED: the scorekeeper marked attendance';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - the scorekeeper does not mark attendance';
end $$;

-- The night is the volunteer set's: a student cannot read the run sheet.
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
insert into nights (org_id, meeting_date, huddle) values (:'org', '2026-10-28', '{"runIdx": 1}');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check((select count(*) from nights) = 0, 'a student does not read the run sheet');

-- Someone outside the ministry reads nothing at all.
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from organizations) = 0 and (select count(*) from score_entries) = 0 and (select count(*) from students) = 0, 'an outsider reads nothing');

reset role;
\echo 'ALL RLS TESTS PASSED'
