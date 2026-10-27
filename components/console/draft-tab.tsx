'use client';
/* CONSOLE · DRAFT & TRADES — how students land on squads. Draft day: snake
   or straight, how many rounds, who picks first; once it starts, one squad
   is on the clock at a time and a pick from the pool moves the draft on.
   Outside a draft, anyone in the pool can be placed directly. Trades move
   a student between squads, with an optional swap back, and every one is
   kept in the history. Points a student already earned stay with the
   squad they earned them for. */
import { useState } from 'react';
import { Section, useSaveConfig } from '@/components/console/kit';
import { Btn, Icon, cx } from '@/components/ui';
import { history } from '@/lib/cycle';
import { DRAFT_DEFAULTS, draftOrder, draftSequence, onTheClock, type DraftSettings, type TradeRecord } from '@/lib/draft';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import type { Student } from '@/lib/types/model';

const ord = (n: number) => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');

export function DraftTab() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const saveConfig = useSaveConfig();
  const teamIds = d.teams.map((t) => t.id);
  const draft: DraftSettings = { ...DRAFT_DEFAULTS(teamIds), ...d.config.draft, order: draftOrder(d.config.draft, teamIds) };
  const clock = onTheClock(draft);
  const total = draftSequence(draft).length;
  const team = (id: string | null) => d.teams.find((t) => t.id === id);
  const iso = d.tonight.date;

  const [q, setQ] = useState('');
  const [grade, setGrade] = useState('');
  const [nu, setNu] = useState({ name: '', grade: '' });
  const [trade, setTrade] = useState<{ from: string; player: string; to: string; back: string }>({ from: teamIds[0] ?? '', player: '', to: teamIds[1] ?? '', back: '' });

  const setDraft = (patch: Partial<DraftSettings>, note?: string) => saveConfig((c) => ({ draft: { ...DRAFT_DEFAULTS(teamIds), ...c.draft, order: draftOrder(c.draft, teamIds), ...patch } }), note);
  const place = (s: Student, to: string, note: string) => {
    const next = { ...s, team: to };
    api().mutate((x) => {
      const r = x.roster.find((y) => y.id === s.id);
      if (r) r.team = to;
    });
    api().emit({ kind: 'student', student: next });
    api().logActivity(note);
  };
  const pick = (s: Student, to: string) => {
    if (clock) {
      if (to !== clock.team) return;
      place(s, to, team(to)?.name + ' drafted ' + s.name + ' · round ' + clock.round + ', pick ' + clock.pickInRound);
      const done = draft.live!.pick + 1 >= total || pool.length === 1;
      setDraft({ live: done ? null : { ...draft.live!, pick: draft.live!.pick + 1 } }, done ? 'The draft is over' : undefined);
      api().say(s.name + ' to ' + team(to)?.name + '.' + (done ? ' That’s the draft.' : ''));
    } else {
      place(s, to, s.name + ' placed on ' + team(to)?.name + ' by ' + m.displayName);
      api().say(s.name + ' is on ' + team(to)?.name + ' now.');
    }
  };

  const pool = d.roster.filter((s) => !s.team);
  const grades = [...new Set(pool.map((s) => s.grade).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
  const needle = q.trim().toLowerCase();
  const shown = pool.filter((s) => (!grade || s.grade === grade) && (!needle || s.name.toLowerCase().includes(needle)));
  const moveOrder = (i: number, dir: number) => {
    const o = [...draft.order];
    const j = i + dir;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    setDraft({ order: o }, 'Draft order: ' + o.map((id) => team(id)?.name).join(', '));
  };

  const fromPlayers = d.roster.filter((s) => s.team === trade.from).sort((a, b) => a.name.localeCompare(b.name));
  const toPlayers = d.roster.filter((s) => s.team === trade.to).sort((a, b) => a.name.localeCompare(b.name));
  const confirmTrade = () => {
    const a = d.roster.find((s) => s.id === trade.player);
    const b = trade.back ? d.roster.find((s) => s.id === trade.back) : undefined;
    if (!a || trade.from === trade.to) return;
    const moves: TradeRecord['moves'] = [{ student: a.name, from: trade.from, to: trade.to }, ...(b ? [{ student: b.name, from: trade.to, to: trade.from }] : [])];
    place(a, trade.to, 'Trade: ' + a.name + ' from ' + team(trade.from)?.name + ' to ' + team(trade.to)?.name + (b ? ', ' + b.name + ' the other way' : ''));
    if (b) place(b, trade.from, b.name + ' traded back to ' + team(trade.from)?.name);
    const rec: TradeRecord = { id: uid(), at: Date.now(), by: m.displayName, moves };
    saveConfig((c) => ({ trades: [rec, ...(c.trades ?? [])] }));
    setTrade((t) => ({ ...t, player: '', back: '' }));
    api().say('Trade made. Points already earned stay with the squad that earned them.');
  };

  return (
    <div className="flex flex-col gap-5">
      <Section
        title="Draft day"
        sub={clock ? 'The draft is on. ' + team(clock.team)?.name + ' picks next.' : 'Squads take turns picking from the students who have no squad yet. Snake reverses the order every other round, so last pick in one round is first in the next.'}
      >
        {clock ? (
          <div className="flex flex-wrap items-center gap-4 rounded-md border border-accent-600 px-4 py-3" role="status" style={{ background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)' }}>
            <span className="h-4 w-4 rounded-full" style={{ background: team(clock.team)?.color }} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium text-neutral-100">On the clock: {team(clock.team)?.name}</div>
              <div className="text-[12.5px] text-neutral-400">
                Round {clock.round} of {draft.rounds} · pick {clock.pickInRound} · {clock.overall} of {total} overall · {pool.length} left in the pool
              </div>
            </div>
            <Btn variant="ghost" className="px-3 text-[13px] text-neutral-400" onClick={() => setDraft({ live: null }, 'Ended the draft early')}>
              End the draft
            </Btn>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <div className="sr-label mb-2">Draft style</div>
                <div className="flex gap-2" role="group" aria-label="Draft style">
                  {(['snake', 'straight'] as const).map((st) => (
                    <button key={st} onClick={() => setDraft({ style: st }, 'Draft style: ' + st)} aria-pressed={draft.style === st} className={cx('min-h-10 rounded-full border px-4 text-[13px]', draft.style === st ? 'border-accent-500 text-accent-100' : 'border-neutral-800 text-neutral-400')}>
                      {st === 'snake' ? 'Snake' : 'Straight'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="sr-label mb-2">Rounds</div>
                <div className="flex items-center gap-2">
                  <button aria-label="One round fewer" disabled={draft.rounds <= 1} onClick={() => setDraft({ rounds: draft.rounds - 1 })} className="flex h-10 w-10 items-center justify-center rounded-md border border-neutral-700 text-neutral-300 disabled:opacity-30">
                    <Icon name="ph ph-minus" className="text-[13px]" />
                  </button>
                  <span className="tabular w-6 text-center text-[15px] text-neutral-100">{draft.rounds}</span>
                  <button aria-label="One round more" disabled={draft.rounds >= 12} onClick={() => setDraft({ rounds: draft.rounds + 1 })} className="flex h-10 w-10 items-center justify-center rounded-md border border-neutral-700 text-neutral-300 disabled:opacity-30">
                    <Icon name="ph ph-plus" className="text-[13px]" />
                  </button>
                </div>
              </div>
            </div>
            <div>
              <div className="sr-label mb-2">Pick order</div>
              <div className="flex max-w-[420px] flex-col gap-2">
                {draft.order.map((id, i) => (
                  <div key={id} className="flex min-h-11 items-center gap-3 rounded-md border border-neutral-800 px-3">
                    <span className="h-[10px] w-[10px] rounded-full" style={{ background: team(id)?.color }} />
                    <span className="flex-1 text-[14px] text-neutral-100">
                      {i + 1}. {team(id)?.name}
                    </span>
                    <button aria-label={'Move ' + team(id)?.name + ' up'} disabled={i === 0} onClick={() => moveOrder(i, -1)} className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-400 disabled:opacity-30">
                      <Icon name="ph ph-arrow-up" className="text-[13px]" />
                    </button>
                    <button aria-label={'Move ' + team(id)?.name + ' down'} disabled={i === draft.order.length - 1} onClick={() => moveOrder(i, 1)} className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-400 disabled:opacity-30">
                      <Icon name="ph ph-arrow-down" className="text-[13px]" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Btn className="px-4" disabled={!pool.length || !draft.order.length} onClick={() => setDraft({ live: { pick: 0, startedAt: Date.now() } }, 'Started the draft: ' + draft.rounds + ' rounds, ' + draft.style)}>
                Start the draft
              </Btn>
              <span className="text-[12.5px] text-neutral-500">{pool.length ? pool.length + ' in the pool. ' + (total >= pool.length ? 'The draft ends when it’s empty.' : total + ' picks, so ' + (pool.length - total) + ' will still need placing.') : 'Nobody is waiting for a squad.'}</span>
            </div>
          </>
        )}
      </Section>

      <Section title="Draft pool" sub="Students with no squad yet: new sign-ups, anyone imported, and anyone pulled off a squad. Attendance is from the last six nights.">
        <div className="flex flex-wrap gap-2">
          <input className="input min-w-[220px] flex-1" placeholder="Find by name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find in the pool" />
          <select className="input w-auto" value={grade} onChange={(e) => setGrade(e.target.value)} aria-label="Grade">
            <option value="">All grades</option>
            {grades.map((g) => (
              <option key={g} value={g}>
                {ord(Number(g))} grade
              </option>
            ))}
          </select>
        </div>
        {!shown.length ? <p className="text-[13px] text-neutral-500">{pool.length ? 'Nobody in the pool matches.' : 'Everyone has a squad.'}</p> : null}
        <div className="flex flex-col gap-2">
          {shown.map((s) => {
            const h = iso ? history(d, s.name, iso) : [];
            const came = h.filter(Boolean).length;
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-md border border-neutral-800 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium text-neutral-100">{s.name}</div>
                  <div className="text-[12px] text-neutral-500">
                    {s.grade ? ord(Number(s.grade)) + ' grade · ' : ''}
                    {came ? came + ' of the last ' + h.length + ' nights' : 'not at a night yet'}
                  </div>
                </div>
                <div className="flex gap-[6px]" role="group" aria-label={'Place ' + s.name}>
                  {d.teams.map((t) => {
                    const turn = !clock || clock.team === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => pick(s, t.id)}
                        disabled={!turn}
                        aria-label={(clock ? 'Draft ' : 'Place ') + s.name + ' on ' + t.name}
                        title={turn ? t.name : t.name + ' isn’t on the clock'}
                        className="flex h-10 min-w-10 items-center justify-center rounded-md border px-2 text-[12.5px] font-semibold disabled:opacity-25"
                        style={{ borderColor: t.color, color: t.color }}
                      >
                        {t.name.slice(0, 1)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t border-divider pt-3">
          <input className="input min-w-[200px] flex-1" placeholder="Name" value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} aria-label="New student’s name" />
          <select className="input w-auto" value={nu.grade} onChange={(e) => setNu({ ...nu, grade: e.target.value })} aria-label="New student’s grade">
            <option value="">Grade</option>
            {[5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
              <option key={g} value={String(g)}>
                {ord(g)}
              </option>
            ))}
          </select>
          <Btn
            variant="secondary"
            className="px-4"
            disabled={!nu.name.trim()}
            onClick={() => {
              const name = nu.name.trim().replace(/\s+/g, ' ');
              if (d.roster.some((r) => r.name.toLowerCase() === name.toLowerCase())) return api().say(name + ' is already on the roster.');
              const student: Student = { id: uid(), name, team: null, grade: nu.grade };
              api().mutate((x) => void x.roster.push(student));
              api().emit({ kind: 'student', student });
              api().logActivity('Added ' + name + ' to the draft pool');
              setNu({ name: '', grade: '' });
            }}
          >
            Add to the pool
          </Btn>
        </div>
      </Section>

      <Section title="Trade" sub="Move a student to another squad, with a swap back if you like. Points they already earned stay with the squad they earned them for.">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_1fr]">
          <label className="field">
            <span className="sr-label">From</span>
            <select aria-label="Trade from" className="input" value={trade.from} onChange={(e) => setTrade({ ...trade, from: e.target.value, player: '', back: '' })}>
              {d.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="sr-label">Student</span>
            <select aria-label="Student to trade" className="input" value={trade.player} onChange={(e) => setTrade({ ...trade, player: e.target.value })}>
              <option value="">Pick a student</option>
              {fromPlayers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <Icon name="ph ph-arrows-left-right" className="self-end pb-3 text-[16px] text-neutral-500" />
          <label className="field">
            <span className="sr-label">To</span>
            <select aria-label="Trade to" className="input" value={trade.to} onChange={(e) => setTrade({ ...trade, to: e.target.value, back: '' })}>
              {d.teams.map((t) => (
                <option key={t.id} value={t.id} disabled={t.id === trade.from}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span className="sr-label">Swap back (optional)</span>
          <select aria-label="Swap back" className="input" value={trade.back} onChange={(e) => setTrade({ ...trade, back: e.target.value })}>
            <option value="">Straight move, no swap</option>
            {toPlayers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} to {team(trade.from)?.name}
              </option>
            ))}
          </select>
        </label>
        <Btn className="self-start px-4" disabled={!trade.player || trade.from === trade.to} onClick={confirmTrade}>
          Confirm trade
        </Btn>
        <div className="sr-label mt-2">Trade history</div>
        {!(d.config.trades ?? []).length ? <p className="text-[13px] text-neutral-500">No trades yet this season.</p> : null}
        {(d.config.trades ?? []).slice(0, 12).map((t) => (
          <div key={t.id} className="flex flex-wrap items-baseline gap-2 border-t border-divider pt-2 text-[13px]">
            <span className="flex-1 text-neutral-200">{t.moves.map((mv) => mv.student + ' to ' + (team(mv.to)?.name ?? 'a removed squad')).join(' · ')}</span>
            <span className="text-[12px] text-neutral-500">
              {t.by} · {new Date(t.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        ))}
      </Section>
    </div>
  );
}
