-- Other ministries read shared library units, so a shared unit may not name
-- anyone this ministry knows: a student, a guardian, or anyone with an
-- account. The phone checks first (lib/library-share.ts); this is the same
-- rule where it can't be skipped. Single words aren't checked — too many
-- names are also ordinary words.

create or replace function public.norm_words(t text)
returns text language sql immutable as $$
  select trim(regexp_replace(regexp_replace(lower(coalesce(t, '')), '[^[:alnum:]'' -]+', ' ', 'g'), '\s+', ' ', 'g'))
$$;

create or replace function public.library_units_names()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_text text;
  v_hit text;
begin
  if not new.shared then return new; end if;
  v_text := ' ' || public.norm_words(concat_ws(' ', new.title, new.summary, new.span, new.theme, array_to_string(new.includes, ' '))) || ' ';
  select n into v_hit from (
    select s.name as n from public.students s where s.org_id = new.org_id
    union select f.guardian from public.families f where f.org_id = new.org_id
    union select m.display_name from public.memberships m where m.org_id = new.org_id
    union select m.student_name from public.memberships m where m.org_id = new.org_id and m.student_name is not null
  ) x
  where public.norm_words(n) like '% %'
    and position(' ' || public.norm_words(n) || ' ' in v_text) > 0
  limit 1;
  if v_hit is not null then
    raise exception 'This unit names %. Take names out before sharing it with other ministries.', trim(v_hit) using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists library_units_names on public.library_units;
create trigger library_units_names before insert or update on public.library_units
  for each row execute function public.library_units_names();
