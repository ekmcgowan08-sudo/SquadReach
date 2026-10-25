-- Saving a ministry document over the revision you last saw.
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
delete from ministry_docs where org_id = :'org' and key = 'deliveries';
select pg_temp.check((public.save_doc(:'org', 'deliveries', '[1]', 0))->>'rev' = '1', 'the first save creates revision 1');
select pg_temp.check((public.save_doc(:'org', 'deliveries', '[1,2]', 1))->>'ok' = 'true', 'saving over the revision you saw works');
select public.save_doc(:'org', 'deliveries', '[9]', 1) as stale \gset
select pg_temp.check((:'stale'::jsonb)->>'ok' = 'false', 'saving over an old revision is refused');
select pg_temp.check((:'stale'::jsonb)->'value' = '[1,2]'::jsonb and (:'stale'::jsonb)->>'rev' = '2', 'and hands back what is there now to merge onto');
select pg_temp.check((select value from ministry_docs where org_id = :'org' and key = 'deliveries') = '[1,2]'::jsonb, 'nothing was overwritten');
select pg_temp.check((public.save_doc(:'org', 'deliveries', '[1,2,3]', 0))->>'ok' = 'false', 'a second first-save is a conflict too');
update ministry_docs set value = '[0]' where org_id = :'org' and key = 'deliveries';
select pg_temp.check((select rev from ministry_docs where org_id = :'org' and key = 'deliveries') = 3, 'any write moves the revision on');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.denied(format('select public.save_doc(%L, %L, %L, 3)', :'org', 'deliveries', '[]'), 'a coach cannot save a ministry document');
reset role;
