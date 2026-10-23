'use client';
/* GAME TIMER — a stopwatch for anything, or a heat for every squad with
   penalty and bonus taps. Posting the heat pays placement points through
   award(), so a timed game lands on the board like any other score. */
import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { Sheet } from '@/components/sheet';
import { Btn, Icon, Screen, tint } from '@/components/ui';
import {
  activeTeams, clock, emptyLane, flipNote, heatRows, laneOf, laneSec, placementAwards, soloSec, startLane, stopLane
} from '@/lib/game';
import { postedLabel, wasHeld } from '@/lib/held';
import { canApprove } from '@/lib/permissions';
import { fmt, pointBase } from '@/lib/scoring';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import type { GameState, Penalty } from '@/lib/types/model';
import { useNow } from '@/lib/use-now';

const CARD_VARS = {
  '--color-neutral-100': '#f3f5fe', '--color-neutral-200': '#e4e7f5', '--color-neutral-300': '#cfd3e5', '--color-neutral-400': '#b2b6ca',
  '--color-neutral-500': '#9397ab', '--color-neutral-600': '#75798c', '--color-accent-100': '#f5f4ff', '--color-accent-200': '#e7e5fe',
  '--color-accent-300': '#d2cefd', '--color-accent-400': '#b5abfc', '--color-accent-500': '#968ae0', '--color-accent-600': '#796cbf', '--color-accent-700': '#5d5294'
} as CSSProperties;

const sel = (on: boolean, color?: string): CSSProperties => ({
  borderColor: on ? color ?? 'var(--color-accent-500)' : 'var(--color-neutral-800)',
  background: on ? 'color-mix(in srgb, ' + (color ?? 'var(--color-accent)') + ' 14%, transparent)' : 'transparent',
  color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-400)'
});

const roundBtn = 'flex h-11 w-11 flex-none items-center justify-center rounded-full border';

export function GamesScreen() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const g = d.game;
  const penalties = d.config.penalties;
  const [editor, setEditor] = useState(false);
  const [q, setQ] = useState('');
  const running = g.solo.startedAt != null || Object.values(g.lanes).some((l) => l.startedAt != null);
  const now = useNow(running);
  const posted = d.tonight.heatPosted;

  /* Every change goes through here: local first, then to the other screens. */
  const change = (fn: (x: GameState) => void, unpost = false) => {
    api().mutate((x) => {
      fn(x.game);
      if (unpost) x.tonight.heatPosted = null;
    });
    api().emit({ kind: 'game', game: api().data.game });
  };

  const rows = heatRows(g, d.teams, penalties, now);
  const shown = rows.filter((r) => !q.trim() || r.team.name.toLowerCase().includes(q.trim().toLowerCase()));
  const flip = flipNote(rows);
  const lanesRunning = rows.filter((r) => r.running).map((r) => r.team.name);
  const clockValue = g.mode === 'single' ? soloSec(g, now) : Math.max(0, ...activeTeams(g, d.teams).map((t) => laneSec(laneOf(g, t.id), now)));
  const clockLabel = g.mode === 'single' ? (g.solo.startedAt != null ? 'Timer running' : 'Timer stopped') : lanesRunning.length ? lanesRunning.join(' + ') + ' running' : 'Clock stopped';
  const soloDone = g.mode === 'single' && g.solo.mode === 'down' && g.solo.startedAt != null && soloSec(g, now) <= 0;

  const toggleLane = (teamId: string) => {
    const t = Date.now();
    change((x) => {
      const lane = x.lanes[teamId] ?? emptyLane();
      x.lanes[teamId] = lane.startedAt != null ? stopLane(lane, t) : startLane(lane, t);
    }, true);
  };
  const startMany = (ids: string[]) => {
    const t = Date.now();
    change((x) => {
      for (const id of ids) x.lanes[id] = startLane(x.lanes[id] ?? emptyLane(), t);
    }, true);
  };
  const tap = (teamId: string, p: Penalty, delta: 1 | -1) => {
    const lane = laneOf(g, teamId);
    if (delta < 0 && !(lane.counts[p.id] ?? 0)) return;
    change((x) => {
      const l = x.lanes[teamId] ?? emptyLane();
      l.counts = { ...l.counts, [p.id]: Math.max(0, (l.counts[p.id] ?? 0) + delta) };
      x.lanes[teamId] = l;
      /* A penalty shows on the projector for as long as it costs. */
      if (delta > 0) x.effects = x.effects.filter((e) => Date.now() < e.startAt + e.sec * 1000).concat({ key: uid(), teamId, penaltyId: p.id, startAt: Date.now(), sec: Math.min(p.sec, 30) || 10 });
    }, true);
  };

  const post = () => {
    if (posted) {
      api().say(wasHeld(posted) ? 'Already recorded and held. Reset the heat to run it again.' : 'Already posted. Reset the heat to run it again.');
      return;
    }
    const awards = placementAwards(rows, pointBase(d.config));
    if (awards.length < 2) {
      api().say('Run at least two squads before posting.');
      return;
    }
    const batch = uid();
    const label = d.config.gameName || 'Game';
    const flag = api().awardMany(awards.map((a) => ({ team: a.team, cat: 'games', amount: a.amount, why: label + ' · placement ' + a.place, batch })));
    if (!flag) return;
    const t = Date.now();
    api().mutate((x) => {
      x.tonight.heatPosted = flag === 'held' ? 'held' : 'posted';
      for (const id of Object.keys(x.game.lanes)) x.game.lanes[id] = stopLane(x.game.lanes[id], t);
    });
    api().emit({ kind: 'game', game: api().data.game });
    const first = d.teams.find((x) => x.id === awards[0].team)?.name ?? '';
    api().sayPosted(first + ' takes it. Games points posted for ' + awards.length + ' squads.', first + ' takes it. Games points for ' + awards.length + ' squads held until you have signal.');
  };

  const reset = () => {
    change((x) => {
      x.lanes = {};
      x.effects = [];
    }, true);
    api().say(api().offline() ? 'Heat cleared. Points already recorded stay held for sending.' : 'Heat cleared. Posted points stay in the ledger.');
  };

  return (
    <Screen label="Games" gap={16.8}>
      <div className="flex items-center gap-[10px]">
        <Link href="/dashboard/more" aria-label="Back" className={roundBtn + ' border-neutral-800 text-neutral-300'}>
          <Icon name="ph ph-caret-left" className="text-[14px]" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-[20px] font-medium leading-[1.15] text-neutral-100">Game timer</div>
          <div className="mt-[3px] truncate text-[11px] leading-[1.3] text-neutral-500">
            Week {d.config.weekNumber} · {d.config.gameName || 'no game set'}
          </div>
        </div>
        <button aria-label="Penalty and bonus buttons" onClick={() => setEditor(true)} className={roundBtn + ' sr-hover border-neutral-800 text-neutral-400'}>
          <Icon name="ph ph-sliders-horizontal" className="text-[15px]" />
        </button>
        <Link href="/dashboard/media?record=1" aria-label="Record with the scoreboard" title="Record with the scoreboard" className={roundBtn + ' sr-hover border-neutral-800 text-neutral-400'}>
          <Icon name="ph ph-video-camera" className="text-[15px]" />
        </Link>
        <Link href="/projector" aria-label="Cast to TV" title="Cast to TV" className={roundBtn + ' border-accent-700 text-accent-200'} style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' }}>
          <Icon name="ph ph-monitor-play" className="text-[15px]" />
        </Link>
      </div>

      <div className="flex gap-[6px]">
        {(
          [
            { id: 'single', label: 'Single' },
            { id: 'h2h', label: 'Head-to-head' },
            { id: 'all', label: 'All teams' }
          ] as const
        ).map((x) => (
          <button key={x.id} onClick={() => change((y) => void (y.mode = x.id))} aria-pressed={g.mode === x.id} className="min-h-11 flex-1 rounded-md border text-[12px] font-medium leading-[1.2]" style={sel(g.mode === x.id)}>
            {x.label}
          </button>
        ))}
      </div>

      <div className="sr-dark flex flex-col gap-3 rounded-lg px-4 pb-4 pt-[15px]" style={{ ...CARD_VARS, background: 'linear-gradient(165deg, var(--color-section), #1c1f3f)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-accent-300">{soloDone ? 'Time' : clockLabel}</span>
          <span className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--color-accent-700), transparent)' }} />
          <span className="h-[7px] w-[7px] rounded-full" style={{ background: running ? 'var(--color-accent-300)' : 'var(--color-neutral-700)', animation: running ? 'sr-pulse 1.4s ease-in-out infinite' : undefined }} />
        </div>
        <div className="tabular text-[52px] font-semibold leading-none tracking-[-.02em] text-neutral-100" aria-live="off">
          {clock(clockValue)}
        </div>
        <div className="text-[11.5px] leading-[1.4] text-accent-300">
          {g.mode === 'single' ? 'A generic countdown or count-up for any activity.' : g.mode === 'h2h' ? 'Pick two squads below, then race them head-to-head.' : 'Start all to run every squad at once, or start rows one at a time.'}
        </div>
        {g.mode === 'single' ? (
          <>
            <div className="flex gap-[7px]">
              {(['up', 'down'] as const).map((md) => (
                <button
                  key={md}
                  onClick={() => change((x) => void (x.solo = { ...x.solo, mode: md, elapsedMs: 0, startedAt: null }))}
                  aria-pressed={g.solo.mode === md}
                  className="min-h-11 flex-1 rounded-md border text-[12px] font-medium leading-[1.2]"
                  style={sel(g.solo.mode === md)}
                >
                  {md === 'up' ? 'Count up' : 'Count down'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-[9px]">
              <button aria-label="Shorter target" onClick={() => change((x) => void (x.solo.targetSec = Math.max(10, x.solo.targetSec - 30)))} className={roundBtn + ' border-accent-700 text-[15px] font-semibold text-accent-200'}>
                −
              </button>
              <div className="flex-1 text-center text-[12px] font-medium leading-none text-accent-200">target {clock(g.solo.targetSec)}</div>
              <button aria-label="Longer target" onClick={() => change((x) => void (x.solo.targetSec += 30))} className={roundBtn + ' border-accent-700 text-[15px] font-semibold text-accent-200'}>
                +
              </button>
            </div>
            <div className="flex gap-[9px]">
              <Btn
                className="min-h-12 flex-[2] justify-center"
                onClick={() => {
                  const t = Date.now();
                  change((x) => {
                    const s = x.solo;
                    x.solo = s.startedAt != null ? { ...s, elapsedMs: s.elapsedMs + (t - s.startedAt), startedAt: null } : { ...s, startedAt: t };
                  });
                }}
              >
                {g.solo.startedAt != null ? 'Stop' : 'Start'}
              </Btn>
              <Btn variant="ghost" className="min-h-12 flex-1 justify-center" onClick={() => change((x) => void (x.solo = { ...x.solo, elapsedMs: 0, startedAt: null }))}>
                Reset
              </Btn>
            </div>
          </>
        ) : null}
        {g.mode === 'all' ? (
          <Btn className="min-h-12 justify-center" onClick={() => startMany(d.teams.map((t) => t.id))}>
            <Icon name="ph-fill ph-play" className="mr-[6px] text-[15px]" />
            Start all squads
          </Btn>
        ) : null}
      </div>

      {g.mode === 'h2h' ? (
        <div>
          <div className="mb-[9px] text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Pick two squads to race</div>
          <div className="grid grid-cols-2 gap-2">
            {d.teams.map((t) => {
              const on = g.h2hPick.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() =>
                    change((x) => {
                      const has = x.h2hPick.includes(t.id);
                      x.h2hPick = has ? x.h2hPick.filter((y) => y !== t.id) : x.h2hPick.length >= 2 ? [x.h2hPick[1], t.id] : x.h2hPick.concat(t.id);
                    }, true)
                  }
                  aria-pressed={on}
                  className="flex min-h-12 items-center gap-2 rounded-md border px-3 text-left"
                  style={sel(on, t.color)}
                >
                  <span className="h-[9px] w-[9px] rounded-full" style={{ background: t.color }} />
                  <span className="text-[12.5px] font-medium leading-none text-neutral-200">{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {g.mode === 'all' ? (
        <div className="relative">
          <Icon name="ph ph-magnifying-glass" className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-neutral-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter squads" aria-label="Filter squads" className="input w-full !pl-[34px]" />
          {q ? (
            <button aria-label="Clear filter" onClick={() => setQ('')} className="absolute right-[6px] top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400">
              <Icon name="ph ph-x" className="text-[13px]" />
            </button>
          ) : null}
        </div>
      ) : null}
      {g.mode === 'all' && q && !shown.length ? <div className="rounded-lg bg-surface px-4 py-[22px] text-center text-[12.5px] leading-[1.5] text-neutral-500">No squad matches that filter.</div> : null}

      {g.mode === 'h2h' && g.h2hPick.length === 2 ? (
        <Btn className="min-h-12 justify-center" onClick={() => startMany(g.h2hPick)}>
          <Icon name="ph-fill ph-play" className="mr-[6px] text-[15px]" />
          Start both squads
        </Btn>
      ) : null}

      {g.mode !== 'single' && (g.mode === 'all' || g.h2hPick.length === 2) ? (
        <div className="flex flex-col gap-[8.4px]">
          {shown.map((r) => {
            const lane = laneOf(g, r.team.id);
            return (
              <div key={r.team.id} className="sr-card relative overflow-hidden px-[14px] pb-[16.8px] pt-[11.2px]">
                <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: r.team.color }} />
                <div className="flex items-center gap-[10px]">
                  <div className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-sm text-[12px] font-semibold leading-none text-neutral-100" style={{ background: tint(r.team.color) }}>
                    {r.place ?? '–'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium leading-[1.2] text-neutral-100">{r.team.name}</div>
                    <div className="mt-[3px] text-[10.5px] leading-[1.3] text-neutral-500">
                      raw {clock(r.raw)} · penalty {(r.pen >= 0 ? '+' : '') + r.pen}s
                    </div>
                  </div>
                  <div className="flex-none text-right">
                    <div className="tabular text-[16px] font-semibold leading-none text-neutral-100">{clock(r.adj)}</div>
                    <div className="mt-1 text-[10px] leading-none text-neutral-500">adjusted</div>
                  </div>
                  <button
                    onClick={() => toggleLane(r.team.id)}
                    className="min-h-11 min-w-16 flex-none rounded-md border text-[11.5px] font-semibold leading-none"
                    style={{ borderColor: r.running ? 'var(--color-accent-400)' : 'var(--color-neutral-800)', background: r.running ? 'color-mix(in srgb, var(--color-accent) 20%, transparent)' : 'transparent', color: r.running ? 'var(--color-accent-100)' : 'var(--color-neutral-300)' }}
                  >
                    {r.running ? 'Stop' : r.ran ? 'Resume' : 'Start'}
                  </button>
                </div>
                <div className="mt-[11.2px] grid grid-cols-4 gap-[5.6px]">
                  {penalties.map((p) => {
                    const n = lane.counts[p.id] ?? 0;
                    return (
                      <div key={p.id} className="flex min-w-0 flex-col items-center gap-[5px] rounded-md border border-neutral-800 px-1 pb-[7px] pt-[6px]">
                        <div className="w-full truncate text-center text-[8.5px] uppercase leading-none tracking-[.04em] text-neutral-500">{p.label}</div>
                        <div className="flex items-center gap-[3px]">
                          <button aria-label={'Remove ' + p.label + ' from ' + r.team.name} onClick={() => tap(r.team.id, p, -1)} className="relative h-[21px] w-[21px] flex-none rounded-[6px] border border-neutral-800 text-[10px] font-semibold leading-none text-neutral-600 before:absolute before:-inset-x-1 before:-inset-y-3 before:content-['']">
                            −
                          </button>
                          <div className="tabular min-w-[10px] text-center text-[12px] font-semibold leading-none" style={{ color: n ? 'var(--color-accent-200)' : 'var(--color-neutral-500)' }}>
                            {n}
                          </div>
                          <button
                            aria-label={'Give ' + r.team.name + ' ' + p.label}
                            onClick={() => tap(r.team.id, p, 1)}
                            className="relative h-[21px] w-[21px] flex-none rounded-[6px] border border-accent-700 text-[10px] font-semibold leading-none text-accent-200 before:absolute before:-inset-x-1 before:-inset-y-3 before:content-['']"
                            style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' }}
                          >
                            +
                          </button>
                        </div>
                        <div className="whitespace-nowrap text-[9.5px] leading-none text-neutral-600">{(p.kind === 'subtract' ? '−' : '+') + p.sec + 's'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {g.mode !== 'single' ? (
        <>
          {flip ? (
            <div className="flex items-start gap-[10px] rounded-lg border border-accent-700 px-[14px] py-[11.2px]" style={{ background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)' }}>
              <Icon name="ph ph-arrows-down-up" className="mt-[1px] flex-none text-[15px] text-accent-300" />
              <div className="text-[11.5px] leading-[1.5] text-accent-200 text-pretty">{flip}</div>
            </div>
          ) : null}
          <div className="flex flex-col gap-[8.4px]">
            <Btn className="min-h-[52px] justify-center" onClick={post}>
              {posted ? postedLabel(posted, 'Results posted ✓', 'Results held until you have signal') : 'Post results to the ledger'}
            </Btn>
            <Btn variant="ghost" className="justify-center" onClick={reset}>
              Reset the heat
            </Btn>
            <div className="text-[10.5px] leading-[1.6] text-neutral-500 text-pretty">
              Placement pays {fmt(pointBase(d.config))} a place to Games. Penalty seconds are set per season, not per night — they live behind the sliders icon above, which is why the fastest raw run does not always win.
            </div>
          </div>
        </>
      ) : null}

      <PenaltyEditor open={editor} onClose={() => setEditor(false)} canEdit={canApprove(m.persona)} />
    </Screen>
  );
}

function PenaltyEditor({ open, onClose, canEdit }: { open: boolean; onClose: () => void; canEdit: boolean }) {
  const penalties = useApp((s) => s.data.config.penalties);
  const api = useAppApi();
  const save = (next: Penalty[]) => {
    api().mutate((x) => {
      x.config.penalties = next;
    });
    api().emit({ kind: 'config', config: api().data.config });
  };
  const patch = (id: string, p: Partial<Penalty>) => save(penalties.map((x) => (x.id === id ? { ...x, ...p } : x)));
  return (
    <Sheet open={open} onClose={onClose} label="Penalty and bonus buttons" maxH="82%">
      <div className="text-[17px] font-medium leading-[1.2] text-neutral-100">Penalty &amp; bonus buttons</div>
      <div className="text-[11.5px] leading-[1.5] text-neutral-500 text-pretty">
        {canEdit
          ? 'These are the buttons on every squad’s timer row. Flip one to a bonus and it subtracts time instead of adding it.'
          : 'Your pastor sets these for the season. They show on every squad’s timer row.'}
      </div>
      <div className="flex flex-col gap-[8.4px]">
        {penalties.map((p) => (
          <div key={p.id} className="flex items-center gap-[10px] rounded-lg bg-neutral-900 px-[13px] py-3" style={{ boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)' }}>
            <Icon name={'ph-fill ' + (p.icon ?? 'ph-sparkle')} className="flex-none text-[16px]" style={{ color: p.color ?? 'var(--color-accent-400)' }} />
            <div className="min-w-0 flex-1">
              {canEdit ? (
                <input value={p.label} onChange={(e) => patch(p.id, { label: e.target.value })} aria-label="Button name" className="w-full border-b border-transparent bg-transparent p-0 text-[13px] font-medium leading-[1.2] text-neutral-100 focus:border-accent-500 focus:outline-none" />
              ) : (
                <div className="text-[13px] font-medium leading-[1.2] text-neutral-100">{p.label}</div>
              )}
              <button disabled={!canEdit} onClick={() => patch(p.id, { kind: p.kind === 'subtract' ? 'add' : 'subtract' })} className="mt-[3px] p-0 text-[11px] font-medium leading-none" style={{ color: p.kind === 'subtract' ? 'var(--color-accent-300)' : 'var(--color-neutral-300)' }}>
                {p.kind === 'subtract' ? 'Bonus · subtracts' : 'Penalty · adds'}
              </button>
            </div>
            <div className="flex flex-none items-center gap-[5px]">
              {canEdit ? (
                <button aria-label="Fewer seconds" onClick={() => patch(p.id, { sec: Math.max(0, p.sec - 5) })} className="relative h-[26px] w-[26px] rounded-[7px] border border-neutral-700 text-[12px] font-semibold text-neutral-400 before:absolute before:inset-x-0 before:-inset-y-[9px] before:content-['']">
                  −
                </button>
              ) : null}
              <div className="tabular min-w-9 text-center text-[13px] font-semibold leading-none text-neutral-200">{p.sec}s</div>
              {canEdit ? (
                <button aria-label="More seconds" onClick={() => patch(p.id, { sec: p.sec + 5 })} className="relative h-[26px] w-[26px] rounded-[7px] border border-accent-700 text-[12px] font-semibold text-accent-200 before:absolute before:inset-x-0 before:-inset-y-[9px] before:content-['']" style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' }}>
                  +
                </button>
              ) : null}
            </div>
            {canEdit ? (
              <button aria-label={'Delete ' + p.label} onClick={() => save(penalties.filter((x) => x.id !== p.id))} className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-neutral-800 text-neutral-600 hover:border-[#a24d4d] hover:text-out">
                <Icon name="ph ph-trash" className="text-[14px]" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {canEdit ? (
        <Btn
          variant="secondary"
          className="min-h-[46px] justify-center"
          onClick={() => {
            save(penalties.concat({ id: uid(), label: 'New penalty', sec: 10, kind: 'add', icon: 'ph-sparkle', color: '#968ae0', style: 'glow', rule: '' }));
            api().logActivity('Added a timer penalty');
          }}
        >
          + Add a penalty or bonus
        </Btn>
      ) : null}
      <Btn className="min-h-12 justify-center" onClick={onClose}>
        Done
      </Btn>
    </Sheet>
  );
}

/** youtu.be/x, youtube.com/watch?v=x or /embed/x → an embeddable URL. */
export function ytEmbedUrl(url: string): string {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/);
  return m ? 'https://www.youtube-nocookie.com/embed/' + m[1] : '';
}

/* ── GAME RULES — what anyone playing needs: when, where, how ──────────── */
export function GameRulesScreen() {
  const d = useApp((s) => s.data);
  const c = d.config;
  const gs = c.gameSetup;
  const now = c.weekNumber;
  const [pick, setPick] = useState(now);
  const weeks = c.meetingDates.length ? c.meetingDates : Array.from({ length: c.seasonWeeks }, () => '');
  const runs = (n: number) => !gs.gameWeeks || gs.gameWeeks.includes(n);
  const iso = c.meetingDates[pick - 1];
  const date = iso ? new Date(iso + 'T00:00:00') : null;
  const address = gs.offsiteAddress.trim() || c.venueAddress;
  const venue = gs.fieldTypes.join(' · ') || 'Venue not set';
  const video = ytEmbedUrl(gs.rulesVideoUrl);
  const kick = 'mb-[7px] text-[9.5px] font-semibold uppercase leading-none tracking-[.11em] text-neutral-500';
  return (
    <Screen label="Game rules">
      <div className="flex items-center gap-[10px]">
        <Link href="/dashboard/more" aria-label="Back" className={roundBtn + ' border-neutral-800 text-neutral-300'}>
          <Icon name="ph ph-caret-left" className="text-[14px]" />
        </Link>
        <div className="text-[20px] font-medium leading-[1.15] text-neutral-100">{c.gameName || 'Game rules'}</div>
      </div>
      <div className="flex items-center gap-[5px] overflow-x-auto pb-[2px]">
        {weeks.map((w, i) => {
          const n = i + 1;
          const past = n < now;
          const on = pick === n;
          const dt = w ? new Date(w + 'T00:00:00') : null;
          return (
            <button
              key={n}
              onClick={() => setPick(n)}
              aria-pressed={on}
              className="flex min-h-12 min-w-11 flex-none flex-col items-center justify-center gap-[3px] rounded-[10px] border px-2"
              style={{
                borderColor: n === now ? 'var(--color-accent-500)' : past ? 'var(--color-neutral-800)' : 'var(--color-neutral-700)',
                background: on ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)' : 'transparent',
                color: past ? 'var(--color-neutral-600)' : n === now ? 'var(--color-accent-100)' : 'var(--color-neutral-300)'
              }}
            >
              <span className="text-[11px] font-semibold leading-none tracking-[.04em]">W{n}</span>
              <span className="text-[9px] leading-none opacity-75">{dt ? dt.getMonth() + 1 + '/' + dt.getDate() : '—'}</span>
              <span className="h-1 w-1 rounded-full" style={{ background: runs(n) ? 'var(--color-accent-400)' : 'transparent' }} />
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-1 rounded-md border border-neutral-800 px-[13px] py-3">
        <div className="text-[12.5px] font-medium leading-[1.2] text-neutral-100">
          Week {pick}
          {pick === now ? ' · tonight' : pick < now ? ' · played' : ' · coming up'}
        </div>
        <div className="text-[11.5px] leading-[1.4] text-neutral-400">
          {date ? date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Date not set'} · {runs(pick) ? c.gameName || 'Game not named yet' : 'No game scheduled — small groups only'}
        </div>
        <div className="text-[11px] leading-[1.5] text-neutral-500 text-pretty">
          {pick < now ? 'Points from this week are locked into the standings.' : pick === now ? 'Scoring is open. Everything logged tonight lands on the board live.' : 'Rules can still change before this one — the pastor posts them here.'}
        </div>
      </div>

      {video ? (
        <div>
          <div className={kick}>How it works</div>
          <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
            <iframe src={video} title="How the game works" className="h-full w-full border-0" allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
          </div>
        </div>
      ) : null}

      {address ? (
        <div className="flex items-start gap-[11px] rounded-md bg-surface px-[13px] py-3" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <Icon name="ph ph-map-pin-line" className="mt-[1px] flex-none text-[17px] text-accent-300" />
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <div className="text-[12.5px] font-medium leading-[1.2] text-neutral-100">
              {venue}
              {gs.offsiteAddress.trim() ? ' · offsite' : ''}
            </div>
            <div className="text-[11.5px] leading-[1.5] text-neutral-400 text-pretty">{address}</div>
            <a href={'https://maps.google.com/?q=' + encodeURIComponent(address)} target="_blank" rel="noreferrer" className="mt-[3px] text-[11px] font-medium leading-none text-accent-300">
              Open in maps →
            </a>
          </div>
        </div>
      ) : null}

      {gs.markupDataUrl ? (
        <div>
          <div className={kick}>Field map</div>
          {/* A data URL the pastor drew in Console; next/image adds nothing here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gs.markupDataUrl} alt="Field map" className="block w-full rounded-md border border-neutral-800" />
        </div>
      ) : (
        <div className="text-[11px] leading-[1.5] text-neutral-500 text-pretty">No field map drawn yet — the pastor marks one up in Console · Scoring and it shows here.</div>
      )}

      <div>
        <div className={kick}>The rules</div>
        <div className="whitespace-pre-wrap text-[13px] leading-[1.6] text-neutral-300 text-pretty">{gs.rulesText || 'Nothing posted yet — check back closer to game time.'}</div>
      </div>
    </Screen>
  );
}
