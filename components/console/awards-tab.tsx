'use client';
/* CONSOLE · AWARDS — full control over every award: rename it, edit its
   description, and for popularity votes choose who can win, how often
   people vote and exactly when voting opens and closes. Score and streak
   trophies read the board as it stands, so they have no voting. */
import { useState } from 'react';
import { Blur, Section } from '@/components/console/kit';
import { Btn, Icon, cx } from '@/components/ui';
import { awardOpen, awardStatus } from '@/lib/awards';
import { isoDay } from '@/lib/dates';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import type { Award } from '@/lib/types/model';

const BUILT_IN = ['aw1', 'aw2', 'aw3', 'aw4', 'aw5', 'aw6'];
const HOW: Record<Award['decidedBy'], string> = { score: 'Score total', streak: 'Longest streak', vote: 'Popularity vote' };

export function AwardsTab() {
  const d = useApp((s) => s.data);
  const api = useAppApi();
  const today = isoDay(new Date());
  const [draft, setDraft] = useState({ name: '', decidedBy: 'vote' as 'vote' | 'score' });

  const saveAwards = (fn: (list: Award[]) => Award[], note?: string) => {
    api().mutate((x) => void (x.awards = fn(x.awards)));
    api().emit({ kind: 'doc', key: 'awards', value: api().data.awards });
    if (note) api().logActivity(note);
  };
  const set = (a: Award, patch: Partial<Award>, note?: string) => saveAwards((list) => list.map((x) => (x.id === a.id ? { ...x, ...patch } : x)), note);
  const add = () => {
    const name = draft.name.trim();
    if (!name) return api().say('Give the award a name.');
    const a: Award =
      draft.decidedBy === 'vote'
        ? { id: uid(), name, description: '', decidedBy: 'vote', recipientType: 'team', voteFrequency: 'once', votingOpen: true, nominees: [] }
        : { id: uid(), name, description: '', decidedBy: 'score', categoryId: null };
    saveAwards((list) => [...list, a], 'Created the award “' + name + '”');
    setDraft({ ...draft, name: '' });
  };

  const open = d.awards.filter((a) => a.decidedBy === 'vote' && awardOpen(a, today)).length;

  return (
    <div className="flex flex-col gap-5">
      <Section
        title="Awards"
        sub="Rename any award and edit what it says. For popularity votes, pick who can win, how often people vote, and schedule exactly when voting opens and closes; the phone and the server both keep to the window. Score and streak trophies read the board as it stands, so they have no voting."
        right={<span className="whitespace-nowrap rounded-full border border-neutral-800 px-3 py-[6px] text-[12px] text-neutral-300">{open === 1 ? '1 open for vote' : open + ' open for vote'}</span>}
      >
        {d.awards.map((a) => {
          const vote = a.decidedBy === 'vote';
          const isOpen = vote && awardOpen(a, today);
          const tally = d.awardTallies?.[a.id] ?? {};
          const votes = Object.values(tally).reduce((n, v) => n + v, 0);
          const leader = Object.entries(tally).sort((x, y) => y[1] - x[1])[0];
          const leaderName = leader ? (a.recipientType === 'team' ? d.teams.find((t) => t.id === leader[0])?.name : a.nominees?.find((n) => n.id === leader[0])?.name) : null;
          return (
            <div key={a.id} role="group" aria-label={'Award: ' + a.name} className="flex flex-col gap-3 rounded-md border border-neutral-800 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Icon name={vote ? 'ph ph-hand-pointing' : a.decidedBy === 'streak' ? 'ph ph-fire' : 'ph ph-trophy'} className="text-[16px] text-accent-300" />
                <Blur label="Award name" value={a.name} onSave={(v) => v && set(a, { name: v }, 'Renamed an award to “' + v + '”')} className="min-w-[180px] flex-1 font-medium" />
                <span className="text-[12px] text-neutral-400">{HOW[a.decidedBy]}</span>
                {vote ? (
                  <span className={cx('rounded-full border px-[10px] py-[5px] text-[11.5px]', isOpen ? 'border-accent-600 text-accent-100' : 'border-neutral-800 text-neutral-400')}>{awardStatus(a, today)}</span>
                ) : null}
                {!BUILT_IN.includes(a.id) ? (
                  <button aria-label={'Remove ' + a.name} onClick={() => window.confirm('Remove “' + a.name + '”?') && saveAwards((list) => list.filter((x) => x.id !== a.id), 'Removed the award “' + a.name + '”')} className="flex h-11 w-11 items-center justify-center rounded-md border border-neutral-800 text-neutral-500 hover:text-neutral-200">
                    <Icon name="ph ph-trash" className="text-[15px]" />
                  </button>
                ) : null}
              </div>
              <Blur area label="Description" value={a.description} placeholder="What it’s for, in a line" onSave={(v) => set(a, { description: v })} />
              {vote ? (
                <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="field">
                    <span className="sr-label">Who can win</span>
                    <select className="input" value={a.recipientType ?? 'team'} onChange={(e) => set(a, { recipientType: e.target.value as 'team' | 'individual' })}>
                      <option value="team">A squad</option>
                      <option value="individual">A student</option>
                    </select>
                  </label>
                  <label className="field">
                    <span className="sr-label">How often people vote</span>
                    <select className="input" value={a.voteFrequency ?? 'once'} onChange={(e) => set(a, { voteFrequency: e.target.value })}>
                      <option value="once">Once per season</option>
                      <option value="weekly">Once per week</option>
                      <option value="daily">Once per day</option>
                    </select>
                  </label>
                  <label className="field">
                    <span className="sr-label">Voting starts</span>
                    <input className="input" type="date" value={a.votingStartDate ?? ''} max={a.votingEndDate ?? undefined} onChange={(e) => set(a, { votingStartDate: e.target.value || null }, e.target.value ? 'Voting on ' + a.name + ' starts ' + e.target.value : undefined)} />
                  </label>
                  <label className="field">
                    <span className="sr-label">Voting ends</span>
                    <input className="input" type="date" value={a.votingEndDate ?? ''} min={a.votingStartDate ?? undefined} onChange={(e) => set(a, { votingEndDate: e.target.value || null }, e.target.value ? 'Voting on ' + a.name + ' ends ' + e.target.value : undefined)} />
                  </label>
                </div>
              ) : a.decidedBy === 'score' ? (
                <label className="field max-w-[280px]">
                  <span className="sr-label">Which points</span>
                  <select className="input" value={a.categoryId ?? ''} onChange={(e) => set(a, { categoryId: e.target.value || null })}>
                    <option value="">All points</option>
                    {d.cats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {vote ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Btn variant="secondary" className="px-4" onClick={() => set(a, { votingOpen: !a.votingOpen }, (a.votingOpen ? 'Closed' : 'Opened') + ' voting on ' + a.name)}>
                    {a.votingOpen ? 'Close voting' : 'Open voting'}
                  </Btn>
                  {a.votingStartDate || a.votingEndDate ? (
                    <Btn variant="ghost" className="px-3 text-accent-300" onClick={() => set(a, { votingStartDate: null, votingEndDate: null }, 'Cleared the voting dates on ' + a.name)}>
                      Clear dates
                    </Btn>
                  ) : null}
                  <span className="text-[12px] text-neutral-400">
                    {votes ? votes + (votes === 1 ? ' vote' : ' votes') + (leaderName ? ' · ' + leaderName + ' leads' : '') : 'No votes yet'}
                    {a.recipientType === 'individual' ? ' · ' + (a.nominees?.length ?? 0) + ' nominated' : ''}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </Section>

      <Section title="Add an award" sub="Every ministry runs its season differently. A vote takes nominations or squads; a score award reads the board.">
        <div className="flex flex-wrap items-end gap-2">
          <label className="field min-w-[220px] flex-1">
            <span className="sr-label">New award name</span>
            <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Best Sportsmanship" />
          </label>
          <label className="field">
            <span className="sr-label">Decided by</span>
            <select className="input" value={draft.decidedBy} onChange={(e) => setDraft({ ...draft, decidedBy: e.target.value as 'vote' | 'score' })}>
              <option value="vote">Popularity vote</option>
              <option value="score">Score total</option>
            </select>
          </label>
          <Btn className="px-4" onClick={add}>
            <Icon name="ph ph-plus" className="mr-[6px] text-[14px]" />
            Add award
          </Btn>
        </div>
      </Section>
    </div>
  );
}
