-- Reports on shared library units: the ministries reading the library are
-- its review. Runs after rls.test.sql, with two more ministries.
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
insert into auth.users values
  ('00000000-0000-0000-0000-000000000011', 'north@example.org'),
  ('00000000-0000-0000-0000-000000000012', 'ridge@example.org')
  on conflict do nothing;
select id as grace from organizations where name = 'Grace Community Students' \gset
select pg_temp.as_user('00000000-0000-0000-0000-000000000011');
select public.create_ministry('Northview Students', 'Pastor Ana') as north \gset
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000012');
select public.create_ministry('Ridge Youth', 'Pastor Sam') as ridge \gset
reset role;

select gen_random_uuid() as unit \gset
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
insert into library_units (id, org_id, kind, title, summary, shared) values (:'unit', :'grace', 'guide', 'Who do you text at 2am?', 'A guide about who you go to.', true);
select pg_temp.denied(format('insert into library_reports (unit_id, org_id, reason) values (%L, %L, %L)', :'unit', :'grace', 'other'), 'a ministry cannot report its own unit');
reset role;

-- ── one report ─────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from library_units where id = :'unit') = 1, 'anyone signed in reads a shared unit');
select pg_temp.denied(format('insert into library_reports (unit_id, org_id, reason) values (%L, %L, %L)', :'unit', :'north', 'other'), 'someone who doesn’t lead a ministry cannot report for it');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000011');
insert into library_reports (unit_id, org_id, reason, note) values (:'unit', :'north', 'unsuitable', 'Too old for our sixth graders.');
select pg_temp.check((select count(*) from library_units where id = :'unit') = 0, 'a ministry that reports a unit stops seeing it at once');
select pg_temp.check((select count(*) from library_reports) = 1, 'and reads its own report');
select pg_temp.denied(format('insert into library_reports (unit_id, org_id, reason) values (%L, %L, %L)', :'unit', :'north', 'wrong'), 'but reports it only once');
select pg_temp.denied(format('insert into library_reports (unit_id, org_id, reason) values (%L, %L, %L)', :'unit', :'north', 'rude'), 'and only for a listed reason');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from library_units where id = :'unit') = 1, 'one report hides it from nobody else');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from library_units where id = :'unit') = 1, 'the sharing ministry still sees its unit');
select pg_temp.check((select count(*) from library_reports) = 0, 'but not the report itself, which would say who');
select pg_temp.check((select reason from library_flags(:'grace') where unit_id = :'unit') = 'unsuitable', 'its leaders see why it was reported');
select pg_temp.check((select note from library_flags(:'grace') where unit_id = :'unit') = 'Too old for our sixth graders.', 'with the note');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check((select count(*) from library_flags(:'grace')) = 0, 'a student of the sharing ministry sees no reports');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000012');
select pg_temp.check((select count(*) from library_flags(:'grace')) = 0, 'nor does another ministry');
reset role;

-- ── a second ministry ──────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-000000000012');
insert into library_reports (unit_id, org_id, reason) values (:'unit', :'ridge', 'wrong');
select pg_temp.check((select count(*) from library_reports) = 1, 'each ministry reads only its own report');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from library_units where id = :'unit') = 0, 'two ministries’ reports hide it from everyone else');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from library_units where id = :'unit') = 1, 'except the ministry that shared it');
select pg_temp.check((select count(*) from library_flags(:'grace') where unit_id = :'unit') = 2, 'which sees both reasons');

-- ── changed, it starts over ────────────────────────────────────────────
update library_units set summary = 'A guide about who you go to, for high schoolers.' where id = :'unit';
select pg_temp.check((select count(*) from library_flags(:'grace')) = 0, 'changing the unit clears its reports');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000011');
select pg_temp.check((select count(*) from library_units where id = :'unit') = 1, 'and it is back for everyone');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
delete from library_units where id = :'unit';
select pg_temp.check((select count(*) from library_units where id = :'unit') = 0, 'a leader stops sharing a unit by removing it');
reset role;
