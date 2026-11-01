-- Taking back a request to join. Runs after rls.test.sql, on the same ministry.
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
set client_min_messages = notice;

reset role;
select id as org, invite_code as code from organizations where name = 'Grace Community Students' \gset
insert into auth.users values ('00000000-0000-0000-0000-000000000009', 'asker@example.org');

select pg_temp.as_user('00000000-0000-0000-0000-000000000009');
select public.request_access(:'code', 'coach', 'Wrong Role Wes') as req \gset
reset role;
select pg_temp.check((select count(*) from push_outbox where dedupe = 'access:' || :'req') = 1, 'a new request queues a push to the leaders');

-- Nobody else can take it back for them.
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
delete from access_requests where id = :'req';
reset role;
select pg_temp.check((select count(*) from access_requests where id = :'req') = 1, 'nobody else withdraws someone''s request');

select pg_temp.as_user('00000000-0000-0000-0000-000000000009');
delete from access_requests where id = :'req';
reset role;
select pg_temp.check((select count(*) from access_requests where id = :'req') = 0, 'the person who asked can withdraw it while it waits');
select pg_temp.check((select count(*) from push_outbox where dedupe = 'access:' || :'req') = 0, 'and the leaders'' push goes with it');

-- A decided request is the record of who was let in; it stays.
select pg_temp.as_user('00000000-0000-0000-0000-000000000009');
select public.request_access(:'code', 'member', 'Wes Again') as req2 \gset
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.decide_access(:'req2', false);
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000009');
delete from access_requests where id = :'req2';
reset role;
select pg_temp.check((select status from access_requests where id = :'req2') = 'denied', 'a decided request can''t be withdrawn');
