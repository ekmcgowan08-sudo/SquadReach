-- Leaders edit the plan (and the other ministry documents) together. Each
-- document carries a revision; save_doc only writes over the revision the
-- client last saw, and otherwise hands back what's there so the client can
-- merge its change onto it (lib/merge3.ts) and try again. Nobody's edit is
-- silently overwritten.

alter table public.ministry_docs add column if not exists rev integer not null default 0;

create or replace function public.ministry_docs_rev()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then new.rev := 1;
  else new.rev := old.rev + 1;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists ministry_docs_rev on public.ministry_docs;
create trigger ministry_docs_rev before insert or update on public.ministry_docs
  for each row execute function public.ministry_docs_rev();

-- Write p_value over revision p_rev. Returns {ok, rev} on success, or
-- {ok: false, rev, value} with what's there now. Runs as the caller, so the
-- docs_write policy still decides who may write at all.
create or replace function public.save_doc(p_org uuid, p_key text, p_value jsonb, p_rev integer)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_rev integer;
  v_cur public.ministry_docs;
begin
  if not public.has_role(p_org, array['leader','owner']::public.membership_role[]) then
    raise exception 'only leaders save ministry documents';
  end if;
  update public.ministry_docs set value = p_value
    where org_id = p_org and key = p_key and rev = p_rev
    returning rev into v_rev;
  if found then return jsonb_build_object('ok', true, 'rev', v_rev); end if;
  if p_rev = 0 then
    insert into public.ministry_docs (org_id, key, value) values (p_org, p_key, p_value)
      on conflict (org_id, key) do nothing
      returning rev into v_rev;
    if found then return jsonb_build_object('ok', true, 'rev', v_rev); end if;
  end if;
  select * into v_cur from public.ministry_docs where org_id = p_org and key = p_key;
  return jsonb_build_object('ok', false, 'rev', v_cur.rev, 'value', v_cur.value);
end $$;
grant execute on function public.save_doc(uuid, text, jsonb, integer) to authenticated;

-- Other leaders' saves arrive over realtime (RLS still applies: students
-- never hear the plan).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.ministry_docs;
  end if;
end $$;
