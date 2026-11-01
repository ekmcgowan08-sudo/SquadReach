-- Someone who asked to join can take the request back while it's still
-- waiting (the welcome page's "Withdraw"): asked as the wrong role, or with
-- the wrong code. A decided request stays, so the record of who was let in
-- or turned down doesn't change. A push to leaders that hasn't gone yet
-- goes with it.
create policy access_withdraw on public.access_requests for delete
  using (user_id = auth.uid() and status = 'pending');

create or replace function public.access_withdrawn() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.push_outbox where org_id = old.org_id and dedupe = 'access:' || old.id and sent_at is null;
  return old;
end $$;
create trigger access_withdrawn after delete on public.access_requests for each row execute function public.access_withdrawn();
