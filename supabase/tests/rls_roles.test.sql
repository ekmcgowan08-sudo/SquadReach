-- Who can grant owner, and who can read a direct message. Runs after the
-- other tests, on the same ministry.
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
insert into auth.users values ('00000000-0000-0000-0000-000000000007', 'leader@example.org');
insert into memberships (org_id, user_id, role, display_name) values (:'org', '00000000-0000-0000-0000-000000000007', 'leader', 'Dana Leader');
select id as m_owner from memberships where org_id = :'org' and role = 'owner' and user_id = '00000000-0000-0000-0000-000000000001' \gset
select id as m_coach from memberships where org_id = :'org' and user_id = '00000000-0000-0000-0000-000000000002' order by created_at limit 1 \gset
select id as m_scorer from memberships where org_id = :'org' and user_id = '00000000-0000-0000-0000-000000000003' order by created_at limit 1 \gset
select id as m_student from memberships where org_id = :'org' and user_id = '00000000-0000-0000-0000-000000000004' order by created_at limit 1 \gset
select id as m_captain from memberships where org_id = :'org' and user_id = '00000000-0000-0000-0000-000000000006' order by created_at limit 1 \gset
select id as m_leader from memberships where org_id = :'org' and user_id = '00000000-0000-0000-0000-000000000007' \gset

-- ── only an owner makes an owner ───────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
update memberships set role = 'scorekeeper' where id = :'m_coach';
select pg_temp.check((select role from memberships where id = :'m_coach') = 'scorekeeper', 'a leader changes a coach''s role');
update memberships set role = 'coach' where id = :'m_coach';
select pg_temp.denied(format('update memberships set role = %L where id = %L', 'owner', :'m_coach'), 'but cannot make anyone an owner');
select pg_temp.denied(format('insert into memberships (org_id, user_id, role, display_name) values (%L, %L, %L, %L)', :'org', '00000000-0000-0000-0000-000000000007', 'owner', 'Me'), 'nor make themselves one');
update memberships set role = 'member' where id = :'m_owner';
delete from memberships where id = :'m_owner';
select pg_temp.check((select role from memberships where id = :'m_owner') = 'owner', 'and cannot demote or remove the owner');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
update memberships set role = 'owner' where id = :'m_leader';
select pg_temp.check((select role from memberships where id = :'m_leader') = 'owner', 'an owner can make another owner');
update memberships set role = 'leader' where id = :'m_leader';

-- ── direct messages ────────────────────────────────────────────────────
reset role;
select case when :'m_coach' < :'m_scorer' then 'dm:' || :'m_coach' || ':' || :'m_scorer' else 'dm:' || :'m_scorer' || ':' || :'m_coach' end as t_adults \gset
select case when :'m_coach' < :'m_student' then 'dm:' || :'m_coach' || ':' || :'m_student' else 'dm:' || :'m_student' || ':' || :'m_coach' end as t_student \gset
select case when :'m_student' < :'m_captain' then 'dm:' || :'m_student' || ':' || :'m_captain' else 'dm:' || :'m_captain' || ':' || :'m_student' end as t_kids \gset

select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
insert into chat_messages (id, org_id, thread_id, author, body) values (gen_random_uuid(), :'org', :'t_adults', :'m_coach', 'Can you cover the clock Wednesday?');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from chat_messages where thread_id = :'t_adults') = 1, 'two adults message each other');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from chat_messages where thread_id = :'t_adults') = 0, 'and nobody else reads it, the owner included');

reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
insert into chat_messages (id, org_id, thread_id, author, body) values (gen_random_uuid(), :'org', :'t_student', :'m_student', 'Can I bring two friends Wednesday?');
select pg_temp.check((select count(*) from chat_messages where thread_id = :'t_student') = 1, 'a student messages their coach');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from chat_messages where thread_id = :'t_student') = 1, 'a thread with a student is open door: a leader reads it');
select pg_temp.denied(format('insert into chat_messages (id, org_id, thread_id, author, body) values (gen_random_uuid(), %L, %L, %L, %L)', :'org', :'t_student', :'m_owner', 'hi'), 'but cannot post in it');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from chat_messages where thread_id = :'t_student') = 0, 'a scorekeeper outside it reads nothing');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.denied(format('insert into chat_messages (id, org_id, thread_id, author, body) values (gen_random_uuid(), %L, %L, %L, %L)', :'org', :'t_kids', :'m_student', 'hey'), 'students cannot message each other');
select pg_temp.denied(format('insert into chat_messages (id, org_id, thread_id, author, body) values (gen_random_uuid(), %L, %L, %L, %L)', :'org', 'dm:' || :'m_student', :'m_student', 'hey'), 'a malformed thread is refused');
select pg_temp.check((select count(*) from public.chat_directory(:'org') where role in ('member', 'captain')) = 0, 'a student''s directory lists only adults');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from public.chat_directory(:'org') where role in ('member', 'captain')) = 2, 'a coach''s directory lists students too');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from public.chat_directory(:'org')) = 0, 'an outsider''s lists nobody');

reset role;
\echo 'ALL ROLE AND MESSAGE TESTS PASSED'
