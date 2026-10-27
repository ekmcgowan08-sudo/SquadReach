-- A challenge can run all season (weeks is null), in the weeks listed, or
-- be paused (an empty list). The console schedules it; the phone shows the
-- challenges running this week.
alter table public.challenges add column if not exists weeks int[];
