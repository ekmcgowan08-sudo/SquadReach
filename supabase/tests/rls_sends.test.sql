-- Report emails: who reads the send log, and who can look up addresses.
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
insert into report_sends (org_id, delivery_id, period, sent, status) values (:'org', 'dl1', 'w:2026-10-25', 3, 'sent');

set role service_role;
select pg_temp.check((select count(*) from public.delivery_emails(:'org', array['Coach Chris', 'coach chris ', 'Nobody Here'])) = 1, 'the server finds one address per name on file, ignoring case and spaces');
select pg_temp.check((select email from public.delivery_emails(:'org', array['Ellison Reid'])) = 'student@example.org', 'a student is found by their roster name');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.denied(format('select * from public.delivery_emails(%L, array[%L])', :'org', 'Pastor Mike'), 'nobody signed in can look up email addresses');
select pg_temp.check((select count(*) from report_sends) = 0, 'a coach does not read the send log');
select pg_temp.denied(format('insert into report_sends (org_id, delivery_id, period) values (%L, %L, %L)', :'org', 'dl1', 'w:2026-11-01'), 'nor can anyone signed in claim a send');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from report_sends where org_id = :'org') = 1, 'a leader reads what went out');
select pg_temp.denied(format('insert into report_sends (org_id, delivery_id, period) values (%L, %L, %L)', :'org', 'dl1', 'w:2026-11-01'), 'but cannot claim a send either — only the server does');
reset role;
