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

-- Bible practice: you log your own; the volunteer set and your captain see it.
reset role;
update memberships set team_id = :'yellow' where user_id in ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000006');
select id as m_student from memberships where user_id = '00000000-0000-0000-0000-000000000004' \gset
select id as m_captain from memberships where user_id = '00000000-0000-0000-0000-000000000006' \gset
select id as m_coach from memberships where user_id = '00000000-0000-0000-0000-000000000002' \gset
select set_config('t.org', :'org', false), set_config('t.m_captain', :'m_captain', false), set_config('t.m_student', :'m_student', false);
select id as red from teams where org_id = :'org' and name = 'Red' \gset
select set_config('t.yellow', :'yellow', false), set_config('t.red', :'red', false);
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
insert into practice_log (org_id, membership_id, who, team_id, day, ref, mode) values (:'org', :'m_student', 'Ellison Reid', :'yellow', '2026-10-23', 'Joshua 1:9', 'flashcard');
select pg_temp.check((select count(*) from practice_log) = 1, 'a student logs their own practice');
do $$ begin
  insert into practice_log (org_id, membership_id, who, day, ref) values (current_setting('t.org')::uuid, current_setting('t.m_captain')::uuid, 'Luke Jarvis', '2026-10-23', 'Joshua 1:9');
  raise exception 'FAILED: logged practice for someone else';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - nobody logs practice for someone else';
end $$;
do $$ begin
  insert into practice_log (org_id, membership_id, who, day, ref) values (current_setting('t.org')::uuid, current_setting('t.m_student')::uuid, 'Ellison Reid', '2026-10-23', 'Joshua 1:9');
  raise exception 'FAILED: two practices on one day';
exception when unique_violation then
  raise notice 'ok - one practice per person per day';
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select pg_temp.check((select count(*) from practice_log) = 1, 'a captain sees their own squad''s practice');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from practice_log) = 1, 'the scorekeeper sees practice');

-- Chat: announcements are read by all and posted by leaders; a squad thread
-- is that squad plus the volunteer set.
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check(public.chat_can(:'org', 'all', false) and not public.chat_can(:'org', 'all', true), 'a student reads announcements but cannot post them');
select pg_temp.check(not public.chat_can(:'org', 'leaders', false), 'a student cannot read the leaders thread');
insert into chat_messages (id, org_id, thread_id, author, author_name, body) values (gen_random_uuid(), :'org', 'team-' || :'yellow', :'m_student', 'Ellison Reid', 'we got this');
select pg_temp.check((select count(*) from chat_messages) = 1, 'a student posts in their own squad thread');
do $$ begin
  insert into chat_messages (id, org_id, thread_id, author, author_name, body) values (gen_random_uuid(), current_setting('t.org')::uuid, 'team-' || current_setting('t.red'), current_setting('t.m_student')::uuid, 'Ellison Reid', 'hi red');
  raise exception 'FAILED: posted in another squad''s thread';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - a student cannot post in another squad''s thread';
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
insert into chat_messages (id, org_id, thread_id, author, author_name, body) values (gen_random_uuid(), :'org', 'leaders', :'m_coach', 'Coach Chris', 'Ty is out tonight');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select pg_temp.check((select count(*) from chat_messages) = 1, 'a captain sees the squad thread, not the leaders thread');

-- Events: a coach proposes, never publishes; RSVP counts are public, names are not.
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
insert into events (org_id, title, status) values (:'org', 'Coaches'' lunch', 'proposed');
do $$ begin
  insert into events (org_id, title, status) values (current_setting('t.org')::uuid, 'Sneaky', 'approved');
  raise exception 'FAILED: a coach published an event';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - a coach can only propose';
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
insert into events (org_id, title) values (:'org', 'Fall retreat') returning id as ev \gset
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
insert into rsvps (event_id, org_id, membership_id, name, status, guests) values (:'ev', :'org', :'m_student', 'Ellison Reid', 'going', 1);
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
insert into rsvps (event_id, org_id, membership_id, name, status) values (:'ev', :'org', :'m_captain', 'Luke Jarvis', 'maybe');
select pg_temp.check((select count(*) from rsvps) = 1, 'a captain sees only their own RSVP');
select pg_temp.check((select going = 1 and maybe = 1 and guests = 1 from public.rsvp_counts(:'org') where event_id = :'ev'), 'but everyone sees the head count');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
update events set rsvp_closed = true where id = :'ev';
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
do $$ begin
  update rsvps set status = 'out' where membership_id = current_setting('t.m_student')::uuid;
  raise exception 'FAILED: changed an answer after RSVPs closed';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - closed RSVPs cannot be changed';
end $$;

-- Albums: a member files their own photo.
insert into media_items (org_id, week, kind, label, created_by) values (:'org', 9, 'photo', 'Game night', :'m_student');
select pg_temp.check((select count(*) from media_items) = 1, 'a member files a photo into the album');

-- Awards: one vote per person per period; only leaders read the tally.
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
insert into award_votes (org_id, award_id, period, membership_id, choice) values (:'org', 'mvp', 'season', :'m_student', 'n1');
do $$ begin
  insert into award_votes (org_id, award_id, period, membership_id, choice) values (current_setting('t.org')::uuid, 'mvp', 'season', current_setting('t.m_student')::uuid, 'n2');
  raise exception 'FAILED: voted twice in one period';
exception when unique_violation then
  raise notice 'ok - one vote per person per period';
end $$;
insert into award_nominees (id, org_id, award_id, name, nominated_by) values (gen_random_uuid(), :'org', 'mvp', 'Wyatt Price', :'m_student');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
insert into award_votes (org_id, award_id, period, membership_id, choice) values (:'org', 'mvp', 'season', :'m_captain', 'n1');
select pg_temp.check((select count(*) from award_votes) = 1, 'a voter sees only their own vote');
select pg_temp.check((select count(*) from award_nominees) = 1, 'everyone sees the nominees');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from award_votes where choice = 'n1') = 2, 'a leader reads the tally');

-- Library: leaders publish; a shared unit is readable by any signed-in ministry.
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
do $$ begin
  insert into library_units (id, org_id, kind, title) values (gen_random_uuid(), current_setting('t.org')::uuid, 'game', 'Sneaky');
  raise exception 'FAILED: a student published to the library';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok - a student cannot publish to the library';
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
insert into library_units (id, org_id, kind, title, church_name, shared) values (gen_random_uuid(), :'org', 'game', 'Pipeline Relay', 'Grace Community Students', true);
insert into library_units (id, org_id, kind, title, shared) values (gen_random_uuid(), :'org', 'lesson', 'Draft notes', false);
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from library_units) = 1, 'another ministry reads the shared unit, not the private one');

-- The public board answers by parent code, anonymously, with no full names.
reset role;
update organizations set config = config || '{"parentShare": {"standings": true, "mvp": true, "verse": true, "calendar": true}}'::jsonb where id = :'org';
select config->>'parentCode' as pcode from organizations where id = :'org' \gset
set role anon;
select pg_temp.check((public.public_board(:'pcode'))->>'ministry' = 'Grace Community Students', 'the public board answers by parent code without signing in');
select pg_temp.check(jsonb_array_length((public.public_board(:'pcode'))->'standings') = 4, 'and shows every squad''s total');
select pg_temp.check(position(' ' in coalesce((public.public_board(:'pcode'))->'mvp'->0->>'name', '')) = 0, 'and only first names');
select pg_temp.check(public.public_board('NOPE') is null, 'a wrong code returns nothing');
reset role;

-- Someone outside the ministry reads nothing at all.
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from organizations) = 0 and (select count(*) from score_entries) = 0 and (select count(*) from students) = 0
  and (select count(*) from chat_messages) = 0 and (select count(*) from media_items) = 0 and (select count(*) from practice_log) = 0, 'an outsider reads nothing');

reset role;
\echo 'ALL RLS TESTS PASSED'
