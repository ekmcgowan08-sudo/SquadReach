-- A shared library unit can't name anyone the ministry knows.
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
create or replace function pg_temp.refused(stmt text, pattern text, msg text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAILED: %', msg;
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  if sqlerrm not like pattern then raise exception 'FAILED: % (refused for another reason: %)', msg, sqlerrm; end if;
  raise notice 'ok - %', msg;
end $$;
set client_min_messages = notice;

reset role;
select id as org from organizations where name = 'Grace Community Students' \gset
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select pg_temp.refused(format($q$insert into library_units (id, org_id, kind, title, summary, shared) values (gen_random_uuid(), %L, 'guide', 'Identity', 'Good week — ellison reid asked great questions.', true)$q$, :'org'), 'This unit names Ellison Reid.%', 'a shared unit naming a student is refused, and says who');
select pg_temp.refused(format($q$insert into library_units (id, org_id, kind, title, summary, includes, shared) values (gen_random_uuid(), %L, 'guide', 'Identity', 'Good week.', array['Led by Coach Chris'], true)$q$, :'org'), 'This unit names Coach Chris.%', 'so is one naming someone with an account, anywhere in it');
insert into library_units (id, org_id, kind, title, summary, shared) values (gen_random_uuid(), :'org', 'guide', 'Identity (ours)', 'Good week — Ellison Reid asked great questions.', false);
select pg_temp.check((select count(*) from library_units where title = 'Identity (ours)') = 1, 'the same notes kept private are fine');
insert into library_units (id, org_id, kind, title, summary, shared) values (gen_random_uuid(), :'org', 'guide', 'Identity', 'Good week — grace and peace to everyone.', true);
select pg_temp.check((select count(*) from library_units where title = 'Identity' and shared) = 1, 'a unit naming nobody is shared (single words like Grace aren’t names here)');
select pg_temp.refused(format($q$update library_units set shared = true where title = 'Identity (ours)' and org_id = %L$q$, :'org'), 'This unit names%', 'and a private unit that names someone can’t be switched to shared');
reset role;
