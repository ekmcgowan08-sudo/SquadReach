-- Change & approve: a leader approves a request as a different role; only
-- an owner can grant owner. Runs after rls_roles.test.sql (which adds the
-- leader 007), on the same ministry.
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
select id as org, invite_code as code from organizations where name = 'Grace Community Students' \gset
insert into auth.users values ('00000000-0000-0000-0000-000000000021', 'chris@example.org'), ('00000000-0000-0000-0000-000000000022', 'pat@example.org') on conflict do nothing;

select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
select public.request_access(:'code', 'leader', 'Chris Sandoval') as req_chris \gset
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000022');
select public.request_access(:'code', 'coach', 'Pat Lee') as req_pat \gset

reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000007');
select public.decide_access(:'req_chris', true, 'coach');
select pg_temp.check((select role from memberships where user_id = '00000000-0000-0000-0000-000000000021') = 'coach', 'a leader approves someone as the role that fits, not the one asked for');
select pg_temp.check((select granted_role from access_requests where id = :'req_chris') = 'coach', 'and the request keeps the role granted');
select pg_temp.check((select count(*) from activity_log where line = 'Approved Chris Sandoval as coach (asked for leader)') = 1, 'and the audit log says both');
select pg_temp.denied(format('select public.decide_access(%L, true, %L)', :'req_pat', 'owner'), 'a leader cannot approve anyone as an owner');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.decide_access(:'req_pat', true, 'scorekeeper');
select pg_temp.check((select role from memberships where user_id = '00000000-0000-0000-0000-000000000022') = 'scorekeeper', 'an owner changes and approves too');
reset role;
