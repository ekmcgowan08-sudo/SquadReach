-- Award voting windows: a vote lands only while voting is on and today is
-- inside the window a leader set. Runs after rls.test.sql, on the same
-- ministry.
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
select id as m_student from memberships where org_id = :'org' and user_id = '00000000-0000-0000-0000-000000000004' order by created_at limit 1 \gset
select (current_date - 10)::text as past, (current_date - 3)::text as ended, (current_date + 3)::text as later \gset

insert into ministry_docs (org_id, key, value) values (:'org', 'awards', jsonb_build_array(
  jsonb_build_object('id', 'spirit', 'decidedBy', 'vote', 'votingOpen', true, 'votingStartDate', :'past', 'votingEndDate', :'later'),
  jsonb_build_object('id', 'soon', 'decidedBy', 'vote', 'votingOpen', true, 'votingStartDate', :'later'),
  jsonb_build_object('id', 'over', 'decidedBy', 'vote', 'votingOpen', true, 'votingEndDate', :'ended'),
  jsonb_build_object('id', 'shut', 'decidedBy', 'vote', 'votingOpen', false),
  jsonb_build_object('id', 'top', 'decidedBy', 'score')))
  on conflict (org_id, key) do update set value = excluded.value;

select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
insert into award_votes (org_id, award_id, period, membership_id, choice) values (:'org', 'spirit', 'season', :'m_student', 'red');
select pg_temp.check((select count(*) from award_votes where award_id = 'spirit') = 1, 'a vote inside the window counts');
select pg_temp.denied(format($q$insert into award_votes (org_id, award_id, period, membership_id, choice) values (%L, 'soon', 'season', %L, 'red')$q$, :'org', :'m_student'), 'a vote before the window opens is refused');
select pg_temp.denied(format($q$insert into award_votes (org_id, award_id, period, membership_id, choice) values (%L, 'over', 'season', %L, 'red')$q$, :'org', :'m_student'), 'a vote after it closes is refused');
select pg_temp.denied(format($q$insert into award_votes (org_id, award_id, period, membership_id, choice) values (%L, 'shut', 'season', %L, 'red')$q$, :'org', :'m_student'), 'a vote on an award closed by hand is refused');
select pg_temp.denied(format($q$insert into award_votes (org_id, award_id, period, membership_id, choice) values (%L, 'top', 'season', %L, 'red')$q$, :'org', :'m_student'), 'a score trophy takes no votes');
select pg_temp.denied(format($q$insert into award_votes (org_id, award_id, period, membership_id, choice) values (%L, 'ghost', 'season', %L, 'red')$q$, :'org', :'m_student'), 'nor does an award that does not exist');
select pg_temp.denied(format($q$insert into award_nominees (id, org_id, award_id, name, nominated_by) values (gen_random_uuid(), %L, 'over', 'Wyatt Price', %L)$q$, :'org', :'m_student'), 'nominations close with the window');
reset role;
