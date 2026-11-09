'use client';
/* CONSOLE · DRAFT & TRADES — how students land on squads. Draft day: snake
   or straight, how many rounds, who picks first; once it starts, one squad
   is on the clock at a time and a pick from the pool moves the draft on.
   Outside a draft, anyone in the pool can be placed directly. After the
   student rounds, coach rounds pick from the coaches serving with no squad
   yet, and a recap shows who went where. Trades move
   a student between squads, with an optional swap back, and every one is
   kept in the history. Points a student already earned stay with the
   squad they earned them for. Dynasty decides the next season: squads
   carry over, or everyone goes back in the pool for a new draft. */
import { useState } from 'react';
import { Section, useSaveConfig } from '@/components/console/kit';
import { useHuddleSave } from '@/components/screens/huddle';
import { Btn, Icon, cx } from '@/components/ui';
import { history } from '@/lib/cycle';
import { nowMs } from '@/lib/dates';
import { DRAFT_DEFAULTS, afterPick, coachPool, draftOrder, draftRecap, draftSequence, onTheClock, type DraftPick, type DraftSettings, type TradeRecord } from '@/lib/draft';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import type { CrewMember, Student } from '@/lib/types/model';

const ord = (n: number) => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');

export function DraftTab() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const saveConfig = useSaveConfig();
  const saveHuddle = useHuddleSave();
  const teamIds = d.teams.map((t) => t.id);
  const draft: DraftSettings = { ...DRAFT_DEFAULTS(teamIds), ...d.config.draft, order: draftOrder(d.config.draft, teamIds) };
  const clock = onTheClock(draft);
  const total = draftSequence(draft).length;
  const coaches = coachPool(d.huddle.crew);
  const coachRounds = draft.coachRounds ?? 1;
  const picks = draft.picks ?? [];
  const team = (id: string | null) => d.teams.find((t) => t.id === id);
  const iso = d.tonight.date;

  const [q, setQ] = useState('');
  const [grade, setGrade] = useState('');
  const [nu, setNu] = useState({ name: '', grade: '' });
  const [trade, setTrade] = useState<{ from: string; player: string; to: string; back: string }>({ from: teamIds[0] ?? '', player: '', to: teamIds[1] ?? '', back: '' });

  const live = d.seasons.find((x) => x.active);
  const setDynasty = (on: boolean) => {
    setDraft({ dynasty: on }, on ? 'Dynasty on: squads carry over into next season' : 'A new draft every season');
    /* The live season's answer goes with it, so a season started from this one carries it on. */
    if (live) {
      const next = api().data.seasons.map((x) => (x.id === live.id ? { ...x, answers: { ...x.answers, assign: on ? 'keep' : 'draft' } } : x));
      api().mutate((x) => void (x.seasons = next));
      api().emit({ kind: 'doc', key: 'seasons', value: next });
    }
  };
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
  /* A pick on the clock: recorded, and the draft moves on — past the rest
     of the student rounds once the pool is empty, and over when nobody's left. */
  const drafted = (kind: DraftPick['kind'], name: string, to: string, left: { students: number; coaches: number }) => {
    const next = afterPick(draft, left);
    const done = next === null;
    const intoCoaches = !done && clock?.kind === 'student' && onTheClock({ ...draft, live: { ...draft.live!, pick: next } })?.kind === 'coach';
    setDraft({ live: done ? null : { ...draft.live!, pick: next }, picks: [...picks, { kind, round: clock!.round, team: to, name }] }, done ? 'The draft is over' : undefined);
    api().say(name + ' to ' + team(to)?.name + '.' + (done ? ' That’s the draft.' : intoCoaches ? ' On to the coaches.' : ''));
  };
  const pick = (s: Student, to: string) => {
    if (clock) {
      if (to !== clock.team || clock.kind !== 'student') return;
      place(s, to, team(to)?.name + ' drafted ' + s.name + ' · round ' + clock.round + ', pick ' + clock.pickInRound);
      drafted('student', s.name, to, { students: pool.length - 1, coaches: coaches.length });
    } else {
      place(s, to, s.name + ' placed on ' + team(to)?.name + ' by ' + m.displayName);
      api().say(s.name + ' is on ' + team(to)?.name + ' now.');
    }
  };

  /* A coach's squad is on the crew; with a live ministry their own membership
     follows, so their phone shows the squad they coach. */
  const placeCoach = (c: CrewMember, to: string, note: string) => {
    const name = team(to)?.name ?? '';
    saveHuddle((x) => void (x.crew = x.crew.map((y) => (y.id === c.id ? { ...y, team: to, job: y.job.includes('·') ? y.job : y.job + ' · ' + name } : y))));
    const person = (api().data.people ?? []).find((p) => p.role === 'coach' && p.name === c.name && p.teamId !== to);
    if (person) {
      const next = { ...person, teamId: to };
      api().mutate((x) => {
        const i = (x.people ??= []).findIndex((y) => y.id === next.id);
        if (i >= 0) x.people[i] = next;
      });
      api().emit({ kind: 'person', person: next });
    }
    api().logActivity(note);
  };
  const pickCoach = (c: CrewMember, to: string) => {
    if (clock) {
      if (to !== clock.team || clock.kind !== 'coach') return;
      placeCoach(c, to, team(to)?.name + ' drafted coach ' + c.name + ' · round ' + clock.round + ', pick ' + clock.pickInRound);
      drafted('coach', c.name, to, { students: pool.length, coaches: coaches.length - 1 });
    } else {
      placeCoach(c, to, c.name + ' now coaches ' + team(to)?.name + ' · placed by ' + m.displayName);
      api().say(c.name + ' coaches ' + team(to)?.name + ' now.');
    }
  };
  const start = () => {
    const withCoaches = coaches.length ? coachRounds : 0;
    setDraft({ live: { pick: pool.length ? 0 : total, startedAt: nowMs(), coachRounds: withCoaches }, picks: [] }, 'Started the draft: ' + draft.rounds + ' student rounds' + (withCoaches ? ', ' + withCoaches + ' coach' : '') + ', ' + draft.style);
  };
  const recap = !clock && picks.length ? draftRecap(picks, draft.order) : null;

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
        sub={clock ? 'The draft is on. ' + team(clock.team)?.name + ' picks next.' : 'Squads take turns picking from the students who have no squad yet, then from the coaches who have none. Snake reverses the order every other round, so last pick in one round is first in the next.'}
      >
        {clock ? (
          <div className="flex flex-wrap items-center gap-4 rounded-md border border-accent-600 px-4 py-3" role="status" style={{ background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)' }}>
            <span className="h-4 w-4 rounded-full" style={{ background: team(clock.team)?.color }} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium text-neutral-100">On the clock: {team(clock.team)?.name}</div>
              <div className="text-[12.5px] text-neutral-400">
                {clock.kind === 'coach' ? 'Coaches · ' : 'Students · '}round {clock.round} of {clock.rounds} · pick {clock.pickInRound} · {clock.overall} of {clock.total} overall · {clock.kind === 'coach' ? coaches.length + (coaches.length === 1 ? ' coach' : ' coaches') + ' left' : pool.length + ' left in the pool'}
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
                <div className="sr-label mb-2">Student rounds</div>
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
              <div>
                <div className="sr-label mb-2">Coach rounds</div>
                <div className="flex items-center gap-2">
                  <button aria-label="One coach round fewer" disabled={coachRounds <= 0} onClick={() => setDraft({ coachRounds: coachRounds - 1 })} className="flex h-10 w-10 items-center justify-center rounded-md border border-neutral-700 text-neutral-300 disabled:opacity-30">
                    <Icon name="ph ph-minus" className="text-[13px]" />
                  </button>
                  <span className="tabular w-6 text-center text-[15px] text-neutral-100">{coachRounds}</span>
                  <button aria-label="One coach round more" disabled={coachRounds >= 6} onClick={() => setDraft({ coachRounds: coachRounds + 1 })} className="flex h-10 w-10 items-center justify-center rounded-md border border-neutral-700 text-neutral-300 disabled:opacity-30">
                    <Icon name="ph ph-plus" className="text-[13px]" />
                  </button>
                </div>
              </div>
            </div>
            <label className="flex max-w-[480px] cursor-pointer items-start gap-3 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-[10px]">
              <input type="checkbox" checked={!!draft.dynasty} onChange={(e) => setDynasty(e.target.checked)} className="mt-[2px] h-5 w-5 flex-none accent-[var(--color-accent)]" />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-neutral-100">Dynasty — rosters carry over each season</span>
                <span className="mt-[2px] block text-[12px] leading-[1.45] text-neutral-500">
                  {draft.dynasty ? 'When the next season goes live, every squad keeps its students. Rivalries carry over.' : 'When the next season goes live, everyone goes back in the pool for a new draft.'}
                </span>
              </span>
            </label>
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
              <Btn className="px-4" disabled={(!pool.length && !(coaches.length && coachRounds)) || !draft.order.length} onClick={start}>
                Start the draft
              </Btn>
              <span className="text-[12.5px] text-neutral-500">
                {pool.length ? pool.length + ' in the pool. ' + (total >= pool.length ? 'The student rounds end when it’s empty.' : total + ' picks, so ' + (pool.length - total) + ' will still need placing.') : 'Nobody is waiting for a squad.'}
                {coachRounds && coaches.length ? ' Then ' + coachRounds + (coachRounds === 1 ? ' coach round' : ' coach rounds') + ' for ' + coaches.length + (coaches.length === 1 ? ' coach.' : ' coaches.') : ''}
              </span>
            </div>
          </>
        )}
        {clock && picks.length ? (
          <div>
            <div className="sr-label mb-2">Picks so far</div>
            <ol className="flex max-w-[520px] flex-col" aria-label="Picks so far">
              {[...picks].reverse().slice(0, 8).map((p, i) => (
                <li key={picks.length - i} className="flex items-center gap-3 border-t border-divider py-[7px] text-[13px] first:border-t-0">
                  <span className="w-[86px] text-[11.5px] text-neutral-500">
                    R{p.round} · {p.kind === 'coach' ? 'Coach' : 'Student'}
                  </span>
                  <span className="h-[9px] w-[9px] rounded-full" style={{ background: team(p.team)?.color }} />
                  <span className="text-neutral-300">{team(p.team)?.name}</span>
                  <span className="text-neutral-100">{p.name}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {recap ? (
          <div>
            <div className="sr-label mb-2">How the draft went</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {recap.map((r) => (
                <div key={r.team} className="rounded-md border border-neutral-800 px-3 py-[10px]" role="group" aria-label={'Drafted by ' + team(r.team)?.name}>
                  <div className="flex items-center gap-2 text-[13.5px] font-medium text-neutral-100">
                    <span className="h-[9px] w-[9px] rounded-full" style={{ background: team(r.team)?.color }} />
                    {team(r.team)?.name}
                    <span className="ml-auto text-[11.5px] font-normal text-neutral-500">{r.students.length + r.coaches.length} picks</span>
                  </div>
                  <div className="mt-1 text-[12.5px] leading-[1.5] text-neutral-300">Students: {r.students.join(', ') || '—'}</div>
                  <div className="text-[12.5px] leading-[1.5] text-neutral-300">Coaches: {r.coaches.join(', ') || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
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
                    const turn = !clock || (clock.team === t.id && clock.kind === 'student');
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

      <Section title="Coaches without a squad" sub="Coaches on the serving crew with no squad yet. The coach rounds pick from here; outside a draft, place one directly. Add coaches in Console › Huddle.">
        {!coaches.length ? <p className="text-[13px] text-neutral-500">Every coach has a squad.</p> : null}
        <div className="flex flex-col gap-2">
          {coaches.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-md border border-neutral-800 px-4 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium text-neutral-100">{c.name}</div>
                <div className="text-[12px] text-neutral-500">{[c.job, c.post].filter(Boolean).join(' · ')}</div>
              </div>
              <div className="flex gap-[6px]" role="group" aria-label={'Place coach ' + c.name}>
                {d.teams.map((t) => {
                  const turn = !clock || (clock.team === t.id && clock.kind === 'coach');
                  return (
                    <button
                      key={t.id}
                      onClick={() => pickCoach(c, t.id)}
                      disabled={!turn}
                      aria-label={(clock ? 'Draft coach ' : 'Place coach ') + c.name + ' on ' + t.name}
                      title={turn ? t.name : clock?.kind === 'student' ? 'Coaches are picked after the students' : t.name + ' isn’t on the clock'}
                      className="flex h-10 min-w-10 items-center justify-center rounded-md border px-2 text-[12.5px] font-semibold disabled:opacity-25"
                      style={{ borderColor: t.color, color: t.color }}
                    >
                      {t.name.slice(0, 1)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
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
