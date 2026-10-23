-- Supabase grants table privileges to `authenticated` by default and lets RLS
-- do the gating. Mirror that so the tests exercise the policies, not grants.
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
