-- A prayer request is read by the leader it's assigned to, and nobody else
-- until it's on the wall. Runs after rls.test.sql, on the same ministry.
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
insert into auth.users values ('00000000-0000-0000-0000-000000000021', 'lou@example.org'), ('00000000-0000-0000-0000-000000000022', 'dee@example.org');
insert into memberships (org_id, user_id, role, display_name) values (:'org', '00000000-0000-0000-0000-000000000021', 'leader', 'Lou Leader'), (:'org', '00000000-0000-0000-0000-000000000022', 'leader', 'Dee Leader');
select id as m_lou from memberships where user_id = '00000000-0000-0000-0000-000000000021' \gset
select id as m_coach from memberships where org_id = :'org' and user_id = '00000000-0000-0000-0000-000000000002' order by created_at limit 1 \gset
select set_config('t.org', :'org', false);

-- A student files one.
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
insert into prayer_requests (org_id, author, who, body) values (:'org', public.my_membership(:'org'), 'Ellison Reid', 'Pray for my dad, he lost his job.') returning id as req \gset
select pg_temp.check((select body from public.prayer_bodies(:'org') where id = :'req') = 'Pray for my dad, he lost his job.', 'whoever sent it can read it');
reset role;

-- Leaders see it exists, not what it says.
select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
select pg_temp.check((select who from prayer_requests where id = :'req') = 'Ellison Reid', 'a leader sees who sent it');
select pg_temp.denied(format('select body from prayer_requests where id = %L', :'req'), 'but can''t read what it says straight from the table');
select pg_temp.check((select count(*) from public.prayer_bodies(current_setting('t.org')::uuid) where id = :'req') = 0, 'or before anyone has taken it');
select pg_temp.denied(format('update prayer_requests set assigned_to = %L where id = %L', :'m_lou', :'req'), 'nobody assigns it to themselves by editing the row');

select pg_temp.check(public.prayer_take(:'req') = 'Lou Leader', 'a leader takes it');
select pg_temp.check((select body from public.prayer_bodies(current_setting('t.org')::uuid) where id = :'req') = 'Pray for my dad, he lost his job.', 'and now reads it');
select pg_temp.check((select mine from public.prayer_bodies(current_setting('t.org')::uuid) where id = :'req'), 'as theirs to decide');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-000000000022');
select pg_temp.check((select assigned_name from prayer_requests where id = :'req') = 'Lou Leader', 'another leader sees who has it');
select pg_temp.check((select count(*) from public.prayer_bodies(current_setting('t.org')::uuid) where id = :'req') = 0, 'and still can''t read it');
select pg_temp.denied(format('select public.prayer_take(%L)', :'req'), 'or take it from them');
update prayer_requests set status = 'wall' where id = :'req';
reset role;
select pg_temp.check((select status from prayer_requests where id = :'req') = 'queued', 'or post it');

select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
select pg_temp.denied(format('select public.prayer_take(%L, %L)', :'req', :'m_coach'), 'it only goes to a leader');
reset role;

-- An owner can take one over — a leader who has left, say.
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check(public.prayer_take(:'req') = 'Pastor Mike', 'an owner can take it over');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
select pg_temp.check((select count(*) from public.prayer_bodies(current_setting('t.org')::uuid) where id = :'req') = 0, 'and the leader who had it no longer reads it');
reset role;

-- Posted, it's everyone's.
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
update prayer_requests set status = 'wall' where id = :'req';
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
select pg_temp.check((select body from public.prayer_bodies(current_setting('t.org')::uuid) where id = :'req') = 'Pray for my dad, he lost his job.', 'once posted, the wall reads it');
reset role;
select pg_temp.check((select count(*) from activity_log where line like 'Took a prayer request from Ellison Reid%' and actor = :'m_lou') = 1, 'and the audit log keeps who took it');

-- Leave the ministry's people as the later tests expect them.
delete from memberships where user_id in ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000022');
