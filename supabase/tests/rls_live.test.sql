-- Live ministry time: who sees the room, who answers, and when. Runs after
-- rls.test.sql, on the same ministry.
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
select id as m_student from memberships where org_id = :'org' and user_id = '00000000-0000-0000-0000-000000000004' order by created_at limit 1 \gset
select id as m_coach from memberships where org_id = :'org' and user_id = '00000000-0000-0000-0000-000000000002' order by created_at limit 1 \gset
select id as m_captain from memberships where org_id = :'org' and user_id = '00000000-0000-0000-0000-000000000006' order by created_at limit 1 \gset

-- ── the plan is a leaders' document ────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
insert into ministry_docs (org_id, key, value) values (:'org', 'plan', '{"gatherings":{}}'), (:'org', 'awards', '[]')
  on conflict (org_id, key) do update set value = excluded.value;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check((select count(*) from ministry_docs where key = 'plan') = 0, 'a student cannot read the plan (debriefs, trivia answers)');
select pg_temp.check((select count(*) from ministry_docs where key = 'awards') = 1, 'but still reads the other documents');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from ministry_docs where key = 'plan') = 0, 'nor can a coach');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from ministry_docs where key = 'plan') = 1, 'a leader can');

-- ── the room ───────────────────────────────────────────────────────────
insert into live_rooms (org_id, meeting_date, state) values (:'org', current_date, jsonb_build_object('open', 'a1', 'endsAt', null));
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check((select count(*) from live_rooms where org_id = :'org') = 1, 'a student sees the room');
update live_rooms set state = '{"open":"a2"}' where org_id = :'org';
select pg_temp.check((select state->>'open' from live_rooms where org_id = :'org') = 'a1', 'but cannot change it');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from live_rooms) = 0, 'someone outside the ministry sees nothing');

-- ── answers ────────────────────────────────────────────────────────────
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
insert into live_answers (org_id, meeting_date, activity_id, member_id, name, nick, answer, answered_at)
  values (:'org', current_date, 'a1', :'m_student', 'Ellison Reid-Fake', 'Elli', '{"choice":1}', now() - interval '1 hour');
select pg_temp.check((select name from live_answers where member_id = :'m_student') = 'Ellison', 'the room shows a first name from the roster, whatever was sent');
select pg_temp.check((select answered_at > now() - interval '1 minute' from live_answers where member_id = :'m_student'), 'and the database stamps the time');
update live_answers set answer = '{"choice":2}' where member_id = :'m_student';
select pg_temp.check((select answer->>'choice' from live_answers where member_id = :'m_student') = '2', 'a student can change their answer while it is open');
select pg_temp.denied(format('insert into live_answers (org_id, meeting_date, activity_id, member_id, answer) values (%L, current_date, %L, %L, %L)', :'org', 'a1', :'m_captain', '{"choice":0}'), 'but cannot answer as someone else');
select pg_temp.denied(format('insert into live_answers (org_id, meeting_date, activity_id, member_id, answer) values (%L, current_date, %L, %L, %L)', :'org', 'a2', :'m_student', '{"choice":0}'), 'nor answer an activity that is not open');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
insert into live_answers (org_id, meeting_date, activity_id, member_id, nick, answer) values (:'org', current_date, 'a1', :'m_captain', 'LJ', '{"choice":1}');
select pg_temp.check((select count(*) from live_answers) = 1, 'each student reads only their own answers');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from live_answers where org_id = :'org') = 2, 'a leader reads the room''s answers');

-- The timer runs out: three seconds' grace, then nothing more lands.
update live_rooms set state = jsonb_build_object('open', 'a1', 'endsAt', floor(extract(epoch from now()) * 1000) - 10000) where org_id = :'org';
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.denied(format('update live_answers set answer = %L where member_id = %L', '{"choice":3}', :'m_student'), 'once time is up an answer can no longer change');
select pg_temp.check((select answer->>'choice' from live_answers where member_id = :'m_student') = '2', 'and the answer stands as it was');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.denied(format('insert into live_answers (org_id, meeting_date, activity_id, member_id, answer) values (%L, current_date, %L, %L, %L)', :'org', 'a1', :'m_coach', '{"choice":0}'), 'and a late answer is refused');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
delete from live_answers where member_id = :'m_student';
select pg_temp.check((select count(*) from live_answers where member_id = :'m_student') = 1, 'a student cannot clear answers');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
delete from live_answers where org_id = :'org';
select pg_temp.check((select count(*) from live_answers where org_id = :'org') = 0, 'a leader can clear the night to run it again');
reset role;
