'use client';
/* Goal scoring for this game — on the phone's game timer and in Console ›
   Live control. Each goal is a Games entry worth the ministry's points per
   goal, credited to whoever scored (and noting the assist); the MVP of the
   game is one more. The count, the room screen and every player's stats
   are read back from the ledger (lib/goals). */
import { useState } from 'react';
import { Sheet } from '@/components/sheet';
import { Btn, Icon, cx } from '@/components/ui';
import { fmt } from '@/lib/scoring';
import { gameGoals, gameMvp } from '@/lib/goals';
import { teamRoster } from '@/lib/selectors';
import { useApp, useAppApi } from '@/lib/store/provider';
import type { LedgerEntry, Team } from '@/lib/types/model';

/** The ledger plus anything held on this phone, so a goal logged without
 *  signal still counts here. */
export function useGameEntries(): LedgerEntry[] {
  const ledger = useApp((s) => s.data.ledger);
  const outbox = useApp((s) => s.outbox);
  return [...ledger, ...outbox.flatMap((o) => (o.kind === 'entry' ? [o.entry] : []))];
}

export function GoalPanel({ teams }: { teams: Team[] }) {
  const d = useApp((s) => s.data);
  const api = useAppApi();
  const g = d.game;
  const entries = useGameEntries();
  const since = g.goalsSince ?? 0;
  const { byTeam, list } = gameGoals(entries, since);
  const mvp = gameMvp(entries, since);
  const value = d.config.goalValue || 25;
  const [logFor, setLogFor] = useState<string | null>(null);
  const [scorer, setScorer] = useState('');
  const [assist, setAssist] = useState('');
  const [mvpPick, setMvpPick] = useState('');

  const toggle = () => {
    const on = !g.goalsOn;
    api().mutate((x) => {
      x.game.goalsOn = on;
      if (on && !x.game.goalsSince) x.game.goalsSince = Date.now();
    });
    api().emit({ kind: 'game', game: api().data.game });
    api().logActivity(on ? 'Turned on goal scoring for ' + (d.config.gameName || 'the game') : 'Turned off goal scoring');
  };
  const newGame = () => {
    api().mutate((x) => void (x.game.goalsSince = Date.now()));
    api().emit({ kind: 'game', game: api().data.game });
    api().say('Goals start again from zero. Goals already logged stay in the ledger.');
  };
  const log = () => {
    if (!logFor) return;
    const team = teams.find((t) => t.id === logFor);
    const flag = api().award({ team: logFor, cat: 'games', amount: value, why: 'Goal' + (scorer ? ' · ' + scorer : '') + (assist ? ' (assist ' + assist + ')' : ''), student: scorer || null, detail: { goal: { assist: assist || null } } });
    if (!flag) return;
    api().sayPosted('Goal for ' + team?.name + (scorer ? ' — ' + scorer : '') + '. +' + fmt(value) + ' Games.', 'Goal for ' + team?.name + ' held until you have signal.');
    setLogFor(null);
    setScorer('');
    setAssist('');
  };
  const takeBack = (teamId: string) => {
    const last = list.find((e) => e.team === teamId);
    if (!last) return;
    const flag = api().award({ team: teamId, cat: 'games', amount: -last.amount, why: 'reversal of ' + last.why, student: last.student, reverses: last.id, by: api().membership.displayName + ' · reversal' });
    if (flag) api().say('Took back the last goal. The original stays in the ledger.');
  };
  const logMvp = () => {
    const kid = d.roster.find((r) => r.name === mvpPick);
    if (!kid?.team) return;
    const flag = api().award({ team: kid.team, cat: 'games', amount: value, why: 'MVP of the game · ' + kid.name, student: kid.name, detail: { mvp: true } });
    if (!flag) return;
    api().logActivity('MVP of the game: ' + kid.name);
    api().sayPosted(kid.name + ' is the MVP. +' + fmt(value) + ' Games.', kid.name + ' is the MVP — held until you have signal.');
    setMvpPick('');
  };

  const playing = teams.flatMap((t) => teamRoster(d, t.id).map((r) => r.name)).sort((a, b) => a.localeCompare(b));
  const squad = logFor ? teamRoster(d, logFor).map((r) => r.name).sort((a, b) => a.localeCompare(b)) : [];

  return (
    <section aria-label="Goal scoring" className="sr-card flex flex-col gap-3 px-[14px] py-[13px]">
      <div className="flex items-center gap-2">
        <Icon name="ph-fill ph-soccer-ball" className="text-[16px] text-accent-300" />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-medium leading-[1.2] text-neutral-100">Goal scoring for this game</div>
          <div className="mt-[3px] text-[11px] leading-[1.35] text-neutral-500">+{fmt(value)} Games per goal, credited to who scored</div>
        </div>
        <button onClick={toggle} aria-pressed={!!g.goalsOn} className={cx('min-h-11 min-w-14 rounded-full border px-3 text-[12px] font-medium', g.goalsOn ? 'border-accent-500 text-accent-100' : 'border-neutral-700 text-neutral-400')}>
          {g.goalsOn ? 'On' : 'Off'}
        </button>
      </div>
      {g.goalsOn ? (
        <>
          <div className="flex flex-wrap gap-2">
            {teams.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-md bg-neutral-900 px-[10px] py-[6px]" style={{ boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)' }}>
                <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                <span className="text-[12.5px] font-medium text-neutral-200">{t.name}</span>
                <button aria-label={'Take back ' + t.name + '’s last goal'} disabled={!byTeam[t.id]} onClick={() => takeBack(t.id)} className="flex h-11 w-9 items-center justify-center rounded-md text-neutral-400 disabled:opacity-40">
                  −
                </button>
                <span className="tabular min-w-5 text-center text-[16px] font-semibold text-neutral-100" aria-label={t.name + ' goals'}>
                  {byTeam[t.id] ?? 0}
                </span>
                <button aria-label={'Goal for ' + t.name} onClick={() => setLogFor(t.id)} className="flex h-11 w-9 items-center justify-center rounded-md border border-accent-700 text-accent-200">
                  +
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11.5px] text-neutral-500">MVP of the game</span>
            {mvp ? (
              <span className="text-[12.5px] text-accent-200">
                <Icon name="ph-fill ph-star" className="mr-1 text-[12px]" />
                {mvp.student}
              </span>
            ) : (
              <>
                <select aria-label="MVP of the game" className="input min-h-11 min-w-[150px] flex-1" value={mvpPick} onChange={(e) => setMvpPick(e.target.value)}>
                  <option value="">Pick a player</option>
                  {playing.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
                <Btn variant="secondary" className="px-3" disabled={!mvpPick} onClick={logMvp}>
                  Name MVP
                </Btn>
              </>
            )}
            <Btn variant="ghost" className="ml-auto px-3 text-[12px]" onClick={newGame}>
              New game
            </Btn>
          </div>
        </>
      ) : null}
      <Sheet open={!!logFor} onClose={() => setLogFor(null)} label="Log a goal" maxH="80%">
        <div className="text-[17px] font-medium leading-[1.2] text-neutral-100">Goal for {teams.find((t) => t.id === logFor)?.name}</div>
        <div className="text-[11.5px] leading-[1.5] text-neutral-500">+{fmt(value)} Games to the squad, credited to who scored. Not sure who? Leave it and the goal still counts.</div>
        <label className="field">
          <span className="sr-label">Who scored</span>
          <select className="input" value={scorer} onChange={(e) => setScorer(e.target.value)}>
            <option value="">Not sure</option>
            {squad.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="sr-label">Assist (optional)</span>
          <select className="input" value={assist} onChange={(e) => setAssist(e.target.value)}>
            <option value="">No assist</option>
            {squad
              .filter((n) => n !== scorer)
              .map((n) => (
                <option key={n}>{n}</option>
              ))}
          </select>
        </label>
        <Btn className="min-h-12 justify-center" onClick={log}>
          Log the goal · +{fmt(value)}
        </Btn>
      </Sheet>
    </section>
  );
}
