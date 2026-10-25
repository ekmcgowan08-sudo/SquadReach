-- Casting the room screen: who can mint a cast link, and what the link
-- reads. Runs after rls.test.sql, on the same ministry.
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
insert into live_rooms (org_id, meeting_date, state) values (:'org', current_date, '{"night":"tonight","open":null,"view":"join"}')
  on conflict (org_id, meeting_date) do update set state = excluded.state;

-- ── minting ────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.denied(format('select live_cast_start(%L, current_date)', :'org'), 'a student cannot cast the room');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.denied(format('select live_cast_start(%L, current_date)', :'org'), 'nor can a coach');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select pg_temp.denied(format('select live_cast_start(%L, current_date)', :'org'), 'nor someone outside the ministry');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select live_cast_start(:'org', current_date) as tok \gset
select pg_temp.check(length(:'tok') = 64, 'a scorekeeper casts it, with a long random link');
select pg_temp.check((select count(*) from live_casts) = 0, 'and the links themselves can’t be listed');
reset role;

-- ── reading ────────────────────────────────────────────────────────────
set role anon;
select pg_temp.check((select live_cast_room(:'tok')->'room'->>'view') = 'join', 'a cast device, signed in as nobody, reads the room');
select pg_temp.check((select live_cast_room(:'tok')->>'ministry') is not null, 'and the ministry’s name');
select pg_temp.check((select live_cast_room(:'tok')->'room' ? 'answers') = false, 'but never the answers');
select pg_temp.check(live_cast_room('nope') is null, 'a made-up link reads nothing');
select pg_temp.denied(format('select live_cast_start(%L, current_date)', :'org'), 'it cannot mint a link of its own');
reset role;

update live_casts set expires_at = now() - interval '1 minute' where token = :'tok';
set role anon;
select pg_temp.check(live_cast_room(:'tok') is null, 'an expired link reads nothing');
reset role;

-- ── stopping ───────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select live_cast_start(:'org', current_date) as tok2 \gset
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.denied(format('select live_cast_stop(%L, current_date)', :'org'), 'a student cannot stop a cast');
reset role;
set role anon;
select pg_temp.check(live_cast_room(:'tok2') is not null, 'so it still reads');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select live_cast_stop(:'org', current_date);
reset role;
set role anon;
select pg_temp.check(live_cast_room(:'tok2') is null, 'a leader stops every cast link for the night');
reset role;
delete from live_rooms where org_id = :'org' and meeting_date = current_date;
