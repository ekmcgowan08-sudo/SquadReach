'use client';
/* TROPHIES & AWARDS — score trophies and streak awards read the board and
   the streaks as they stand; vote awards take one vote per person per
   period (season, day or week), and leaders see the tally. */
import { useState } from 'react';
import { useStandings } from '@/components/dashboard/standings-list';
import { Btn, Icon, Screen, ScreenHeader } from '@/components/ui';
import { awardOpen, awardStatus } from '@/lib/awards';
import { isoDay, periodKey } from '@/lib/dates';
import { canApprove } from '@/lib/permissions';
import { categoryTotals, fmt } from '@/lib/scoring';
import { computeBadges, teamOf } from '@/lib/selectors';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import { useNow } from '@/lib/use-now';
import type { Award } from '@/lib/types/model';

const FREQ: Record<string, string> = { once: 'Once per season', daily: 'Once per day', weekly: 'Once per week' };
const kicker = 'mb-[9px] text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500';

function Bars({ rows, nameW }: { rows: { name: string; color: string; value: number; label: string }[]; nameW: number }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="mt-[11px] flex flex-col gap-[7px]">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-[9px]">
          <span className="h-2 w-2 flex-none rounded-full" style={{ background: r.color }} />
          <span className="flex-none truncate text-[11.5px] font-medium leading-none text-neutral-300" style={{ width: nameW }}>
            {r.name}
          </span>
          <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full rounded-full" style={{ width: Math.round((r.value / max) * 100) + '%', background: r.color }} />
          </div>
          <span className="tabular flex-none text-[11px] font-semibold leading-none text-neutral-300">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

export function AwardsScreen() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const rows = useStandings();
  const manage = canApprove(m.persona);
  const [nominee, setNominee] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState({ name: '', description: '', decidedBy: 'vote' as Award['decidedBy'], recipientType: 'team' as 'team' | 'individual', voteFrequency: 'once', categoryId: '' });
  const badges = computeBadges(d);
  const today = isoDay(new Date(useNow(true, 60_000)));

  const saveAwards = (fn: (list: Award[]) => Award[]) => {
    api().mutate((x) => void (x.awards = fn(x.awards)));
    api().emit({ kind: 'doc', key: 'awards', value: api().data.awards });
  };

  const vote = (a: Award, choice: string) => {
    if (!awardOpen(a, today)) return api().say('Voting on ' + a.name + ' isn’t open.');
    const period = periodKey(a.voteFrequency);
    if (d.awardVotes[a.id]?.[period]) {
      api().say(a.voteFrequency === 'once' ? 'You already voted on this one this season.' : 'You already voted this ' + (a.voteFrequency === 'daily' ? 'day' : 'week') + '.');
      return;
    }
    api().mutate((x) => {
      (x.awardVotes[a.id] ??= {})[period] = choice;
      if (x.awardTallies) (x.awardTallies[a.id] ??= {})[choice] = (x.awardTallies[a.id][choice] ?? 0) + 1;
    });
    api().emit({ kind: 'vote', awardId: a.id, period, choice });
    api().say('Vote counted. Nobody sees who you picked.');
  };

  const nominate = (a: Award) => {
    const name = (nominee[a.id] ?? '').trim();
    if (!name) return;
    if ((a.nominees ?? []).some((n) => n.name.toLowerCase() === name.toLowerCase())) return api().say(name + ' is already nominated.');
    const id = uid();
    api().mutate((x) => {
      const r = x.awards.find((y) => y.id === a.id);
      if (r) r.nominees = [...(r.nominees ?? []), { id, name }];
    });
    api().emit({ kind: 'nominee', awardId: a.id, id, name });
    api().logActivity('Nominated ' + name + ' for ' + a.name);
    setNominee((n) => ({ ...n, [a.id]: '' }));
    api().say(name + ' is on the ballot.');
  };

  const create = () => {
    if (!draft.name.trim()) return api().say('Give the award a name.');
    const a: Award = {
      id: uid(),
      name: draft.name.trim(),
      description: draft.description.trim(),
      decidedBy: draft.decidedBy,
      ...(draft.decidedBy === 'vote' ? { recipientType: draft.recipientType, voteFrequency: draft.voteFrequency, votingOpen: true, nominees: [] } : { categoryId: draft.categoryId || null })
    };
    saveAwards((list) => [...list, a]);
    api().logActivity('Created the award “' + a.name + '”');
    setDraft({ ...draft, name: '', description: '' });
    api().say('Added. It shows for everyone now.');
  };

  const score = d.awards.filter((a) => a.decidedBy === 'score');
  const streak = d.awards.filter((a) => a.decidedBy === 'streak');
  const votes = d.awards.filter((a) => a.decidedBy === 'vote');
  const custom = (a: Award) => !['aw1', 'aw2', 'aw3', 'aw4', 'aw5', 'aw6'].includes(a.id);

  const header = (a: Award, extra?: React.ReactNode) => (
    <div className="flex items-center gap-2">
      <div className="flex-1 text-[13.5px] font-medium leading-[1.2] text-neutral-100">{a.name}</div>
      {extra}
      {manage && custom(a) ? (
        <button onClick={() => window.confirm('Remove “' + a.name + '”?') && saveAwards((list) => list.filter((x) => x.id !== a.id))} className="min-h-11 px-1 text-[10.5px] leading-none text-neutral-500">
          Remove
        </button>
      ) : null}
    </div>
  );

  return (
    <Screen label="Awards" gap={16}>
      <ScreenHeader title="Trophies & Awards" back="/dashboard/more" />

      {score.length ? (
        <div>
          <div className={kicker}>
            <Icon name="ph-fill ph-trophy" className="mr-[5px] text-accent-400" />
            Score-based trophies
          </div>
          <div className="flex flex-col gap-[10px]">
            {score.map((a) => {
              const ranked = rows
                .map((t) => ({ t, value: a.categoryId ? categoryTotals(d.ledger, t.id)[a.categoryId] ?? 0 : t.total }))
                .sort((x, y) => y.value - x.value);
              const max = ranked[0]?.value ?? 0;
              const close = ranked.length > 1 && max > 0 && (max - ranked[1].value) / max < 0.1;
              return (
                <div key={a.id} className="sr-card px-[15px] py-[14px]">
                  {header(a, close ? <span className="rounded-full px-2 py-1 text-[10px] font-semibold leading-none text-accent-200" style={{ background: 'color-mix(in srgb, var(--color-accent) 16%, transparent)' }}>Close race!</span> : null)}
                  <div className="mt-[3px] text-[11px] leading-[1.4] text-neutral-500 text-pretty">{a.description}</div>
                  <Bars nameW={70} rows={ranked.map((r) => ({ name: r.t.name, color: r.t.color, value: r.value, label: fmt(r.value) }))} />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {streak.length ? (
        <div>
          <div className={kicker}>
            <Icon name="ph-fill ph-book-open-text" className="mr-[5px] text-accent-400" />
            Bible &amp; engagement trophies
          </div>
          <div className="flex flex-col gap-[10px]">
            {streak.map((a) => {
              const key = a.metric === 'bible' ? 'bibleStreak' : a.metric === 'attendance' ? 'attendStreak' : 'combinedWeeks';
              const ranked = [...badges].sort((x, y) => y[key] - x[key]).slice(0, 5);
              return (
                <div key={a.id} className="sr-card px-[15px] py-[14px]">
                  {header(a)}
                  <div className="mt-[3px] text-[11px] leading-[1.4] text-neutral-500 text-pretty">{a.description}</div>
                  {ranked.length ? (
                    <Bars nameW={100} rows={ranked.map((b) => ({ name: b.name, color: teamOf(d, b.teamId).color, value: b[key], label: b[key] + (key === 'bibleStreak' ? ' days' : ' wks') }))} />
                  ) : (
                    <div className="mt-[11px] text-[11px] text-neutral-500">No streaks yet.</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {votes.length ? (
        <div>
          <div className={kicker}>
            <Icon name="ph ph-hand-pointing" className="mr-[5px] text-accent-400" />
            Vote-based awards
          </div>
          <div className="flex flex-col gap-[10px]">
            {votes.map((a) => {
              const team = a.recipientType === 'team';
              const opts = team ? d.teams.map((t) => ({ key: t.id, label: t.name, color: t.color })) : (a.nominees ?? []).map((n) => ({ key: n.id, label: n.name, color: 'var(--color-accent-500)' }));
              const period = periodKey(a.voteFrequency);
              const mine = d.awardVotes[a.id]?.[period];
              const open = awardOpen(a, today);
              const tally = d.awardTallies?.[a.id] ?? {};
              return (
                <div key={a.id} className="sr-card px-[15px] py-[14px]">
                  {header(
                    a,
                    manage ? (
                      <>
                        <select
                          value={a.voteFrequency ?? 'once'}
                          onChange={(e) => saveAwards((list) => list.map((x) => (x.id === a.id ? { ...x, voteFrequency: e.target.value } : x)))}
                          className="input !min-h-11 w-auto !px-[6px] text-[10.5px]"
                          aria-label="How often people can vote"
                        >
                          <option value="once">Once</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                        </select>
                        <button
                          onClick={() => {
                            saveAwards((list) => list.map((x) => (x.id === a.id ? { ...x, votingOpen: !x.votingOpen } : x)));
                            api().logActivity((a.votingOpen ? 'Closed' : 'Opened') + ' voting on ' + a.name);
                          }}
                          className="min-h-11 rounded-full border border-neutral-700 px-[9px] text-[11px] font-medium leading-none text-neutral-300"
                        >
                          {a.votingOpen ? 'Close voting' : 'Open voting'}
                        </button>
                      </>
                    ) : null
                  )}
                  <div className="mt-[3px] text-[11px] leading-[1.4] text-neutral-500 text-pretty">{a.description}</div>
                  <div className="mt-[5px] text-[10px] leading-none text-accent-300">
                    {FREQ[a.voteFrequency ?? 'once']} · <span className={open ? '' : 'text-neutral-500'}>{awardStatus(a, today)}</span>
                  </div>
                  <div className="mt-[11px] flex flex-col gap-2">
                    {opts.map((o) => (
                      <div key={o.key} className="flex items-center gap-[9px]">
                        <span className="h-2 w-2 flex-none rounded-full" style={{ background: o.color }} />
                        <span className="flex-1 text-[12px] font-medium leading-[1.2] text-neutral-200">
                          {o.label} {mine === o.key ? <Icon name="ph-fill ph-check-circle" className="text-[12px] text-accent-300" /> : null}
                        </span>
                        {manage && d.awardTallies ? <span className="tabular text-[11px] text-neutral-500">{tally[o.key] ?? 0}</span> : null}
                        {open && !mine ? (
                          <Btn variant="secondary" className="!min-h-11 px-[13px] text-[12px]" onClick={() => vote(a, o.key)}>
                            Vote
                          </Btn>
                        ) : null}
                      </div>
                    ))}
                    {!opts.length ? <div className="text-[11px] text-neutral-500">No nominees yet.</div> : null}
                  </div>
                  <div className="mt-2 text-[10.5px] leading-[1.4] text-neutral-500">{!open ? (a.votingOpen && a.votingStartDate && today < a.votingStartDate ? 'Voting hasn’t opened yet.' : 'Voting is closed.') : mine ? 'You voted on this one.' : ''}</div>
                  {!team && open ? (
                    <div className="mt-[10px] flex gap-[7px]">
                      <input value={nominee[a.id] ?? ''} onChange={(e) => setNominee((n) => ({ ...n, [a.id]: e.target.value }))} className="input flex-1" placeholder="Add a nominee" aria-label={'Nominate someone for ' + a.name} list={'roster-' + a.id} />
                      <datalist id={'roster-' + a.id}>
                        {d.roster.map((r) => (
                          <option key={r.name} value={r.name} />
                        ))}
                      </datalist>
                      <Btn variant="secondary" className="px-3" onClick={() => nominate(a)}>
                        + Nominate
                      </Btn>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {manage ? (
        <div className="sr-card p-[15px]">
          <div className="text-[13.5px] font-medium leading-[1.2] text-neutral-100">Create a custom award</div>
          <div className="mt-[3px] text-[11px] leading-[1.4] text-neutral-500 text-pretty">Every ministry runs its season differently — add awards that fit yours.</div>
          <div className="mt-[11px] flex flex-col gap-2">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="input" placeholder="Award name" aria-label="Award name" />
            <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="input" placeholder="Description" aria-label="Description" />
            <div className="flex gap-2">
              <select value={draft.decidedBy} onChange={(e) => setDraft({ ...draft, decidedBy: e.target.value as Award['decidedBy'] })} className="input flex-1" aria-label="How it is decided">
                <option value="vote">Popularity vote</option>
                <option value="score">Score total</option>
              </select>
              {draft.decidedBy === 'vote' ? (
                <select value={draft.recipientType} onChange={(e) => setDraft({ ...draft, recipientType: e.target.value as 'team' | 'individual' })} className="input flex-1" aria-label="Who can win">
                  <option value="team">A squad</option>
                  <option value="individual">A student</option>
                </select>
              ) : (
                <select value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })} className="input flex-1" aria-label="Which points">
                  <option value="">All points</option>
                  {d.cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {draft.decidedBy === 'vote' ? (
              <select value={draft.voteFrequency} onChange={(e) => setDraft({ ...draft, voteFrequency: e.target.value })} className="input" aria-label="How often people vote">
                <option value="once">Vote once per season</option>
                <option value="weekly">Vote once per week</option>
                <option value="daily">Vote once per day</option>
              </select>
            ) : null}
            <Btn className="justify-center" onClick={create}>
              Add award
            </Btn>
          </div>
        </div>
      ) : null}
    </Screen>
  );
}
