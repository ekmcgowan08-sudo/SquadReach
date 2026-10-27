-- Flagging a chat thread for a leader. Runs after rls_roles.test.sql, on
-- the same ministry and the same direct messages.
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
select id as m_coach from memberships where org_id = :'org' and user_id = '00000000-0000-0000-0000-000000000002' order by created_at limit 1 \gset
select id as m_scorer from memberships where org_id = :'org' and user_id = '00000000-0000-0000-0000-000000000003' order by created_at limit 1 \gset
select case when :'m_coach' < :'m_scorer' then 'dm:' || :'m_coach' || ':' || :'m_scorer' else 'dm:' || :'m_scorer' || ':' || :'m_coach' end as t_adults \gset

-- Nobody flags a thread they can't read.
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.denied(format('insert into chat_flags (org_id, thread_id, thread_name) values (%L, %L, %L)', :'org', :'t_adults', 'Coach ↔ Scorekeeper'), 'a student cannot flag a thread they cannot read');
reset role;

-- The owner can't read two adults' messages until one of them flags it.
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from chat_messages where thread_id = :'t_adults') = 0, 'before a flag, leaders cannot read an adult-only message');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
insert into chat_flags (org_id, thread_id, thread_name, by_name, seen_at) values (:'org', :'t_adults', 'Coach Chris', 'Somebody Else', now());
select pg_temp.check((select by_name from chat_flags where thread_id = :'t_adults') <> 'Somebody Else', 'the flag carries the real name, not one typed in');
select pg_temp.check((select seen_at from chat_flags where thread_id = :'t_adults') is null, 'and starts unseen');
select pg_temp.check((select count(*) from chat_flags) = 1, 'whoever flagged it sees their flag');
select pg_temp.denied(format('select public.chat_flag_seen(%L)', (select id from chat_flags limit 1)), 'but cannot clear it');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from chat_flags) = 1, 'a leader sees the flag');
select pg_temp.check((select count(*) from chat_messages where thread_id = :'t_adults') = 1, 'and can now read the thread');
select pg_temp.denied(format('insert into chat_messages (id, org_id, thread_id, author, body) values (gen_random_uuid(), %L, %L, (select id from memberships where user_id = %L and org_id = %L limit 1), %L)', :'org', :'t_adults', '00000000-0000-0000-0000-000000000001', :'org', 'hi'), 'but still cannot post in it');
select public.chat_flag_seen((select id from chat_flags limit 1));
select pg_temp.check((select seen_by from chat_flags limit 1) = 'Pastor Mike', 'marking it seen keeps who read it');
delete from chat_flags where org_id = :'org';
update chat_flags set by_name = 'Nobody' where org_id = :'org';
select pg_temp.check((select count(*) from chat_flags where by_name <> 'Nobody') = 1, 'a flag cannot be deleted or rewritten');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select pg_temp.check((select count(*) from chat_flags) = 0, 'a captain sees no one else''s flags');
reset role;
