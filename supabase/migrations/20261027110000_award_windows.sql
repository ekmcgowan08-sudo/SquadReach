-- Award voting windows. A vote award takes votes and nominations only
-- while a leader has voting on and today, in the ministry's own zone,
-- falls inside the window they set (votingStartDate..votingEndDate, both
-- optional). The awards live in ministry_docs 'awards'; lib/awards.ts
-- applies the same rule on the phone.
create or replace function public.award_vote_open(p_org uuid, p_award text)
returns boolean language sql stable security definer set search_path = public as $$
  with a as (
    select x as award
    from public.ministry_docs d,
      jsonb_array_elements(case when jsonb_typeof(d.value) = 'array' then d.value else '[]'::jsonb end) x
    where d.org_id = p_org and d.key = 'awards' and x->>'id' = p_award
    limit 1
  ), t as (
    select (now() at time zone coalesce(
      (select z.name from pg_timezone_names z where z.name = o.config->>'timeZone'),
      'America/Chicago'))::date::text as today
    from public.organizations o where o.id = p_org
  )
  select coalesce((
    select a.award->>'decidedBy' = 'vote'
      and coalesce(a.award->>'votingOpen', 'false') = 'true'
      and (coalesce(a.award->>'votingStartDate', '') = '' or t.today >= a.award->>'votingStartDate')
      and (coalesce(a.award->>'votingEndDate', '') = '' or t.today <= a.award->>'votingEndDate')
    from a, t
  ), false);
$$;

drop policy if exists vote_cast on public.award_votes;
create policy vote_cast on public.award_votes for insert
  with check (
    membership_id in (select m.id from public.memberships m where m.user_id = auth.uid() and m.org_id = award_votes.org_id)
    and public.award_vote_open(org_id, award_id)
  );
drop policy if exists nominee_add on public.award_nominees;
create policy nominee_add on public.award_nominees for insert
  with check (
    nominated_by in (select m.id from public.memberships m where m.user_id = auth.uid() and m.org_id = award_nominees.org_id)
    and public.award_vote_open(org_id, award_id)
  );
