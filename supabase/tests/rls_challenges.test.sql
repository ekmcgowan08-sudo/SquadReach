-- Challenges: leaders set them up (with the weeks they run); everyone in
-- the ministry reads them; nobody else writes them.
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
insert into challenges (id, org_id, kind, title, weeks) values ('00000000-0000-0000-00cc-000000000001', :'org', 'Team', 'Bring a friend', '{3,4}');
select pg_temp.check((select weeks from challenges where id = '00000000-0000-0000-00cc-000000000001') = '{3,4}', 'a leader schedules a challenge for weeks 3 and 4');
update challenges set weeks = null where id = '00000000-0000-0000-00cc-000000000001';
select pg_temp.check((select weeks is null from challenges where id = '00000000-0000-0000-00cc-000000000001'), 'and can set it to run all season');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from challenges where id = '00000000-0000-0000-00cc-000000000001') = 1, 'a coach reads it');
select pg_temp.denied(format($q$insert into challenges (org_id, title) values (%L, 'Sneaky')$q$, :'org'), 'but can’t add one');
update challenges set title = 'Changed' where id = '00000000-0000-0000-00cc-000000000001';
reset role;
select pg_temp.check((select title from challenges where id = '00000000-0000-0000-00cc-000000000001') = 'Bring a friend', 'or change one');

select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from challenges where id = '00000000-0000-0000-00cc-000000000001') = 0, 'someone outside the ministry sees none');
reset role;
delete from challenges where id = '00000000-0000-0000-00cc-000000000001';
