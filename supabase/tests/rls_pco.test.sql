-- Planning Center: tokens never reach a client; leaders see the status.
-- Runs after rls.test.sql, on the same ministry.
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

select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((select pco_status(:'org')->>'connected') = 'false', 'a leader sees it isn’t connected yet');
select pg_temp.denied(format($q$insert into pco_connections (org_id, access_token, refresh_token, expires_at) values (%L, 'a', 'r', now())$q$, :'org'), 'and can’t write tokens from the app');
reset role;

-- The server connects it (with the service role; here, as the owner).
insert into pco_connections (org_id, access_token, refresh_token, expires_at, scope, pco_org_name) values (:'org', 'secret-access', 'secret-refresh', now() + interval '2 hours', 'people check_ins', 'Grace Church');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((select pco_status(:'org')->>'org') = 'Grace Church', 'a leader sees it connected, and to what');
select pg_temp.check((select pco_status(:'org')::text) not like '%secret%', 'but never the tokens');
select pg_temp.check((select count(*) from pco_connections) = 0, 'and can’t read the table');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.check((select pco_status(:'org')::text) = '{"connected": true}', 'a coach, who takes attendance, sees only that it’s connected');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check(pco_status(:'org') is null, 'a student sees nothing');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select pg_temp.check(pco_status(:'org') is null, 'nor does someone outside the ministry');
reset role;

-- A check-in from Planning Center is recorded as such.
select id as sid from students where org_id = :'org' order by name limit 1 \gset
insert into attendance (org_id, meeting_date, student_id, present, via) values (:'org', current_date, :'sid', true, 'pco')
  on conflict (org_id, meeting_date, student_id) do update set via = 'pco';
select pg_temp.check((select via from attendance where org_id = :'org' and meeting_date = current_date and student_id = :'sid') = 'pco', 'attendance accepts a Planning Center check-in');
select pg_temp.denied(format($q$update attendance set via = 'sms' where org_id = %L and student_id = %L$q$, :'org', :'sid'), 'and nothing it doesn’t know');
delete from attendance where org_id = :'org' and meeting_date = current_date and student_id = :'sid';
delete from pco_connections where org_id = :'org';
