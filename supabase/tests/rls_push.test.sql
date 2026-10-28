-- Push: subscriptions, the queue the triggers fill, and nudges. Runs after
-- rls.test.sql, on the same ministry and people.
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
select id as red from teams where org_id = :'org' and name = 'Red' \gset
insert into students (org_id, team_id, name, grade) values (:'org', :'red', 'Rory Banks', '7');
delete from push_outbox;
select set_config('t.org', :'org', false);

-- ── subscriptions ──────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select public.push_subscribe('https://push.example.org/a', 'key-a', 'auth-a', '{"nudge": false}');
select pg_temp.check((select count(*) from push_subscriptions) = 1, 'turning push on keeps this phone''s subscription');
select pg_temp.check((select prefs->>'nudge' from push_subscriptions) = 'false', 'with the choices made on this phone');
select pg_temp.denied($$select public.push_subscribe('http://push.example.org/b', 'k', 'a')$$, 'a push endpoint has to be https');
select pg_temp.denied($$insert into push_subscriptions (endpoint, user_id, p256dh, auth) values ('https://push.example.org/c', '00000000-0000-0000-0000-000000000001', 'k', 'a')$$, 'nobody files a subscription for someone else');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from push_subscriptions) = 0, 'nobody reads another person''s subscription');
select public.push_prefs('https://push.example.org/a', '{}');
reset role;
select pg_temp.check((select prefs->>'nudge' from push_subscriptions where endpoint = 'https://push.example.org/a') = 'false', 'or changes its choices');

-- One phone, one account: whoever last turned push on there.
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select public.push_subscribe('https://push.example.org/a', 'key-a2', 'auth-a2');
select pg_temp.check((select count(*) from push_subscriptions) = 1, 'signing in on a shared phone takes its pushes over');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check((select count(*) from push_subscriptions) = 0, 'and the last person no longer gets them');
reset role;

-- ── the queue ──────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
insert into door_flags (org_id, meeting_date, name) values (:'org', '2026-11-04', 'Kai Newman');
select pg_temp.check((select count(*) from push_outbox) = 0, 'nobody reads the push queue');
select pg_temp.denied(format($$insert into push_outbox (org_id, to_users, trigger, title) values (%L, array['00000000-0000-0000-0000-000000000001']::uuid[], 'event', 'Free pizza')$$, :'org'), 'or writes to it');
select pg_temp.denied(format($$select public.push_enqueue(%L, array['00000000-0000-0000-0000-000000000001']::uuid[], 'event', 'Free pizza', '', '/')$$, :'org'), 'or queues a push of their own');
reset role;

select pg_temp.check((select title from push_outbox where dedupe like 'door:%') = 'Someone new at the door', 'someone new at the door pushes the volunteers on the floor');
select pg_temp.check((select '00000000-0000-0000-0000-000000000001'::uuid = any(to_users) and not '00000000-0000-0000-0000-000000000002'::uuid = any(to_users) from push_outbox where dedupe like 'door:%'), 'everyone but whoever flagged them');

select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
insert into serve_swaps (org_id, from_name, meeting_date, role) values (:'org', 'Coach Chris', '2026-11-04', 'Games');
insert into events (org_id, title, status, proposed_by) values (:'org', 'Bowling night', 'proposed', 'Coach Chris · coach');
reset role;
select pg_temp.check((select body from push_outbox where dedupe like 'swap:%') = 'Coach Chris can’t do games on Wed, Nov 4', 'a swap request tells the leaders who and when');
select pg_temp.check((select to_users = array['00000000-0000-0000-0000-000000000001']::uuid[] from push_outbox where dedupe like 'swap:%'), 'and only the leaders');
select pg_temp.check((select body from push_outbox where dedupe like 'event:%') = 'Bowling night · Coach Chris', 'an event proposal reaches the leaders to approve');

select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
insert into prayer_requests (org_id, who, body) values (:'org', 'Ellison Reid', 'Please pray for my grandma this week');
reset role;
select pg_temp.check((select title || ' / ' || body from push_outbox where dedupe like 'prayer:%') = 'New prayer request / Nothing is public until you post it.', 'a prayer request pushes without its words or its name');

-- The huddle: told once per publish, asked once per post.
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
insert into nights (org_id, meeting_date, huddle) values (:'org', '2026-11-04',
  '{"crew": [{"id": "c1", "name": "Pastor Mike", "post": "Front door"}], "runSheet": [{"id": "r1", "time": "6:15", "label": "Games", "where": "Gym", "assignedTo": "c1", "notifiedAt": null}]}');
reset role;
select pg_temp.check((select count(*) from push_outbox where dedupe like 'own:%') = 0, 'an owner nobody has told yet gets nothing');
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
update nights set huddle = jsonb_set(huddle, '{runSheet,0,notifiedAt}', '1793000000000') where org_id = :'org' and meeting_date = '2026-11-04';
update nights set huddle = jsonb_set(huddle, '{runIdx}', '1') where org_id = :'org' and meeting_date = '2026-11-04';
reset role;
select pg_temp.check((select count(*) from push_outbox where dedupe like 'own:%') = 1, 'publishing tells the owner once, however often the sheet saves');
select pg_temp.check((select title || ' / ' || body from push_outbox where dedupe like 'own:%') = 'You own 6:15 · Games / It’s yours tonight. Where: Gym.', 'with the block and where it is');
select pg_temp.check((select to_users from push_outbox where dedupe like 'own:%') = array['00000000-0000-0000-0000-000000000001']::uuid[], 'to whoever goes by that name');

select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
update nights set huddle = huddle || '{"bench": [{"id": "b1", "name": "Sam Okafor"}], "openPosts": [{"id": "p1", "post": "Snack table", "why": "Nobody signed up"}], "subAsks": {"p1": ["b1"]}}'::jsonb
  where org_id = :'org' and meeting_date = '2026-11-04';
update nights set huddle = jsonb_set(huddle, '{runIdx}', '2') where org_id = :'org' and meeting_date = '2026-11-04';
reset role;
select pg_temp.check((select count(*) from push_outbox where dedupe like 'ask:%') = 1, 'asking the bench to cover a post pushes them once');
select pg_temp.check((select title from push_outbox where dedupe like 'ask:%') = 'Can you cover Snack table tonight?', 'naming the post');

-- ── nudges ─────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-000000000006');
insert into nudges (org_id, meeting_date, student, by_name) values (:'org', '2026-11-04', 'Ellison Reid', 'Somebody Else');
select pg_temp.check((select by_name from nudges) = 'Luke Jarvis', 'a nudge carries the captain''s real name');
select pg_temp.denied(format($$insert into nudges (org_id, meeting_date, student) values (%L, '2026-11-04', 'Ellison Reid')$$, :'org'), 'one nudge a night is enough');
select pg_temp.denied(format($$insert into nudges (org_id, meeting_date, student) values (%L, '2026-11-04', 'Rory Banks')$$, :'org'), 'a captain nudges their own squad, not another');
insert into nudges (org_id, meeting_date, student, kind) values (:'org', '2026-11-04', 'Ellison Reid', 'home');
reset role;
select pg_temp.check((select to_users from push_outbox where dedupe like 'nudge:%') = array['00000000-0000-0000-0000-000000000004']::uuid[], 'the nudge pushes the student');
select pg_temp.check((select body from push_outbox where dedupe like 'nudge:%') = 'Luke checked — are you coming tonight?', 'saying who checked');
select pg_temp.check((select title || ' / ' || array_to_string(to_users, ',') from push_outbox where dedupe like 'home:%') = 'Text Ellison Reid’s household? / 00000000-0000-0000-0000-000000000001', 'asking for a text home goes to a leader, who has the number');
select pg_temp.check((select url from push_outbox where dedupe like 'home:%') = '/dashboard/parents?family=Ellison%20Reid', 'and opens that family''s card');

select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select pg_temp.check((select count(*) from nudges) = 1, 'the student sees they were nudged');
select pg_temp.check((select kind from nudges) = 'push', 'but not that someone asked for a text home');
select pg_temp.denied(format($$insert into nudges (org_id, meeting_date, student) values (%L, '2026-11-11', 'Ellison Reid')$$, :'org'), 'a student does not nudge');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
insert into nudges (org_id, meeting_date, student) values (:'org', '2026-11-04', 'Rory Banks');
select pg_temp.check((select count(*) from nudges) = 3, 'a coach nudges anyone on the roster and sees the night''s nudges');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select pg_temp.check((select count(*) from nudges) = 0, 'an outsider sees none');
reset role;

-- ── nudging an event's no-replies ──────────────────────────────────────
insert into events (org_id, title, date_label) values (:'org', 'Lock-in', 'Fri, Nov 6') returning id as ev \gset
select id as m_student from memberships where org_id = :'org' and user_id = '00000000-0000-0000-0000-000000000004' order by created_at limit 1 \gset
insert into rsvps (event_id, org_id, membership_id, name, status) values (:'ev', :'org', :'m_student', 'Ellison Reid', 'going');
delete from push_outbox;
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select pg_temp.denied(format('select public.event_nudge(%L)', :'ev'), 'only a leader nudges an event''s no-replies');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.event_nudge(:'ev') as nudged \gset
select pg_temp.check(:'nudged'::int >= 1, 'a leader''s nudge reaches the people who haven''t answered');
select pg_temp.check(public.event_nudge(:'ev') is null, 'and is once a day, whoever taps it next');
reset role;
select pg_temp.check((select title from push_outbox where dedupe like 'rsvp:%') = 'Are you coming to Lock-in?', 'asking whether they''re coming');
select pg_temp.check((select body from push_outbox where dedupe like 'rsvp:%') = 'Fri, Nov 6 — answer on the Calendar.', 'and when it is');
select pg_temp.check((select not '00000000-0000-0000-0000-000000000004'::uuid = any(to_users) and '00000000-0000-0000-0000-000000000003'::uuid = any(to_users) from push_outbox where dedupe like 'rsvp:%'), 'never someone who already answered');
select pg_temp.check((select nudged_at is not null from events where id = :'ev'), 'and the event remembers it was nudged');
