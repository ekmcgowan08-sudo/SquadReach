'use client';
/* PROJECTOR — the gym TV. Idle, it is the board: standings that flash when
   they move, the clock, and a ticker of what just scored. When the timer
   runs a heat, every lane gets its own big clock and penalty effects play
   over the lane for as long as they cost. It reads the same store the
   phones write, so in Supabase mode it follows them over realtime. */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Ready } from '@/components/shell/phone-shell';
import { Icon, tint } from '@/components/ui';
import { bracketChampion, bracketSeeds, buildBracket, nextBracketGame } from '@/lib/feeds';
import { bracketOf, clock, heatRows, liveEffects, soloSec } from '@/lib/game';
import { gameGoals } from '@/lib/goals';
import { fmt, standings } from '@/lib/scoring';
import { catOf, teamOf } from '@/lib/selectors';
import { useApp } from '@/lib/store/provider';
import { useNow } from '@/lib/use-now';

const EFFECT_ANIM: Record<string, string> = {
  glow: 'sr-glow 1.1s ease-in-out infinite',
  chaos: 'sr-chaos .5s ease-in-out infinite',
  confetti: 'sr-grow 1.4s ease-in-out infinite',
  blur: 'sr-pulse 1.6s ease-in-out infinite',
  flash: 'sr-flash .8s ease-in-out infinite',
  scale: 'sr-shrink 1.2s ease-in-out infinite'
};

export function Projector() {
  return (
    <Ready>
      <Board />
    </Ready>
  );
}

function Board() {
  const d = useApp((s) => s.data);
  const g = d.game;
  const lanesRunning = Object.values(g.lanes).some((l) => l.startedAt != null);
  const soloRunning = g.mode === 'single' && g.solo.startedAt != null;
  const showLanes = g.mode !== 'single' && heatRows(g, d.teams, d.config.penalties).some((r) => r.ran || r.running);
  const now = useNow(true, lanesRunning || soloRunning ? 100 : 1000);
  const goals = gameGoals(d.ledger, g.goalsSince ?? 0);
  const bracket = bracketOf(g);
  const nextUp = nextBracketGame(d.teams, d.ledger, bracket);
  const champ = bracket.enabled ? bracketChampion(buildBracket(bracketSeeds(d.teams, d.ledger, bracket), bracket.winners)) : null;
  const [full, setFull] = useState(false);

  /* Keep the TV from sleeping mid-game, where the browser allows it. */
  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } };
    const take = () => nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined);
    void take();
    const onVis = () => document.visibilityState === 'visible' && void take();
    document.addEventListener('visibilitychange', onVis);
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('fullscreenchange', onFs);
      void lock?.release();
    };
  }, []);

  const rows = standings(d.teams, d.cats, d.ledger);
  const recent = d.ledger
    .filter((e) => e.status === 'approved' && !e.reverses)
    .sort((a, b) => b.at - a.at)
    .slice(0, 8);
  const ticker = recent.map((e) => (e.amount > 0 ? '+' : '') + fmt(e.amount) + ' ' + catOf(d, e.cat).label + ' → ' + teamOf(d, e.team).name + (e.student ? ' · ' + e.student.split(' ')[0] : '')).join('     ·     ');
  const time = new Date(now).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="sr-dark fixed inset-0 flex flex-col overflow-hidden px-[44px] py-9 text-neutral-100" style={{ background: 'radial-gradient(120% 90% at 50% -10%, #232748 0%, #0c0e18 65%)' }}>
      <div className={'absolute right-5 top-5 z-10 flex gap-2 transition-opacity ' + (full ? 'opacity-0 hover:opacity-100' : '')}>
        <button
          aria-label={full ? 'Leave full screen' : 'Full screen'}
          onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen?.())}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-800 text-neutral-400"
          style={{ background: 'rgba(0,0,0,.3)' }}
        >
          <Icon name={full ? 'ph ph-corners-in' : 'ph ph-corners-out'} className="text-[16px]" />
        </button>
        <Link href="/dashboard/games" aria-label="Close the projector" className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-800 text-neutral-400" style={{ background: 'rgba(0,0,0,.3)' }}>
          <Icon name="ph ph-x" className="text-[16px]" />
        </Link>
      </div>
      <div className="flex flex-none items-baseline gap-[14px]">
        <span className="text-[13px] font-semibold uppercase leading-none tracking-[.14em] text-accent-300">{d.config.ministryName}</span>
        <span className="text-[13px] leading-none text-neutral-500">
          Week {d.config.weekNumber}
          {d.config.gameName ? ' · ' + d.config.gameName : ''}
        </span>
      </div>

      {soloRunning ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="text-[22px] font-medium text-neutral-500">{g.solo.mode === 'down' ? 'Time left' : 'Time'}</div>
          <div className="tabular text-[min(28vw,240px)] font-semibold leading-none">{clock(soloSec(g, now))}</div>
        </div>
      ) : showLanes ? (
        <div className="mt-7 grid min-h-0 flex-1 auto-cols-fr grid-flow-col gap-[22px]">
          {heatRows(g, d.teams, d.config.penalties, now).map((r) => {
            const fx = liveEffects(g, now).filter((e) => e.teamId === r.team.id).pop();
            const p = fx ? d.config.penalties.find((x) => x.id === fx.penaltyId) : undefined;
            const remain = fx ? Math.max(0, Math.ceil(fx.sec - (now - fx.startAt) / 1000)) : 0;
            return (
              <div key={r.team.id} className="relative flex flex-col items-center justify-center gap-[18px] overflow-hidden rounded-[24px] bg-surface" style={{ boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)', containerType: 'inline-size' }}>
                <div className="absolute inset-x-0 top-0 h-[6px]" style={{ background: r.team.color }} />
                <div className="text-[20px] font-semibold uppercase leading-none tracking-[.04em] text-neutral-200">{r.team.name}</div>
                <div className="tabular whitespace-nowrap font-semibold leading-none" style={{ fontSize: 'min(22cqw, 180px)' }}>
                  {clock(r.adj)}
                </div>
                <div className="text-[15px] text-neutral-500">
                  {r.place ? '#' + r.place + ' · ' : ''}raw {clock(r.raw)} {r.pen ? '· ' + (r.pen > 0 ? '+' : '') + r.pen + 's' : ''}
                </div>
                {g.goalsOn ? (
                  <div className="tabular text-[30px] font-semibold leading-none text-accent-300" aria-label={r.team.name + ' goals'}>
                    {goals.byTeam[r.team.id] ?? 0} <span className="text-[15px] font-medium text-neutral-500">{(goals.byTeam[r.team.id] ?? 0) === 1 ? 'goal' : 'goals'}</span>
                  </div>
                ) : null}
                {fx && p ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-[14px]" style={{ background: 'color-mix(in srgb, ' + (p.color ?? r.team.color) + ' 26%, #06070d)' }}>
                    <div className="flex flex-col items-center gap-[14px]" style={{ animation: EFFECT_ANIM[p.style ?? 'glow'] ?? EFFECT_ANIM.glow, ['--fx-color' as string]: p.color }}>
                    <Icon name={'ph-fill ' + (p.icon ?? 'ph-sparkle')} className="text-[56px]" style={{ color: p.color, filter: 'drop-shadow(0 0 18px ' + p.color + ')' }} />
                    <div className="text-center text-[34px] font-bold uppercase leading-none tracking-[.05em] text-white">{p.label}</div>
                    {p.rule ? <div className="max-w-[78%] text-center text-[13px] font-medium leading-[1.5] text-white/85 text-pretty">{p.rule}</div> : null}
                    {fx.by ? <div className="text-[13px] font-semibold uppercase tracking-[.08em] text-white/80">{teamOf(d, fx.by).name} used it</div> : null}
                    <div className="rounded-full px-3 py-1 text-[15px] font-semibold leading-none text-white" style={{ background: 'rgba(0,0,0,.35)' }}>
                      {remain}s
                    </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-[26px]">
          <div className="flex items-baseline gap-4">
            <div className="text-[22px] font-medium leading-[1.2] text-neutral-500">Standings</div>
            <div className="tabular text-[22px] font-semibold leading-none text-accent-300">{time}</div>
          </div>
          <div className="flex w-full max-w-[720px] flex-col gap-[14px]">
            {rows.map((row, i) => (
              <div key={row.id + ':' + row.total} className="flex items-center gap-[18px] rounded-[18px] bg-surface px-[22px] py-4" style={{ boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)', animation: 'sr-flashbg 1.6s ease-out' }}>
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[16px] font-semibold leading-none text-neutral-100" style={{ background: tint(row.color) }}>
                  {i + 1}
                </div>
                <span className="h-3 w-3 flex-none rounded-full" style={{ background: row.color }} />
                <div className="flex-1 text-[24px] font-medium leading-none text-neutral-100">{row.name}</div>
                <div className="tabular text-[30px] font-semibold leading-none text-neutral-100">{fmt(row.total)}</div>
              </div>
            ))}
          </div>
          {ticker && !liveEffects(g, now).length ? (
            <div className="w-full max-w-[960px] overflow-hidden rounded-full bg-surface py-[10px]" style={{ boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)' }}>
              <div className="flex w-max animate-sr-marquee whitespace-nowrap">
                <span className="px-7 text-[15px] font-medium leading-none text-neutral-400">{ticker}</span>
                <span className="px-7 text-[15px] font-medium leading-none text-neutral-400" aria-hidden="true">
                  {ticker}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      )}
      {!showLanes && g.goalsOn ? (
        <div className="pointer-events-none absolute right-[44px] top-[78px] flex items-center gap-4 rounded-full bg-surface px-5 py-3" style={{ boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)' }} aria-label="Goals this game">
          <Icon name="ph-fill ph-soccer-ball" className="text-[18px] text-accent-300" />
          {d.teams.map((t) => (
            <span key={t.id} className="flex items-center gap-2 text-[18px] font-semibold text-neutral-100">
              <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
              <span className="tabular">{goals.byTeam[t.id] ?? 0}</span>
            </span>
          ))}
        </div>
      ) : null}
      {!showLanes && bracket.enabled && (nextUp || champ) ? (
        <div className="pointer-events-none absolute left-[44px] top-[78px] flex items-center gap-3 rounded-full bg-surface px-5 py-3 text-[17px] font-semibold text-neutral-100" style={{ boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)' }} aria-label="Tournament">
          <Icon name={champ ? 'ph-fill ph-trophy' : 'ph ph-tree-structure'} className="text-[18px] text-accent-300" />
          {champ ? (
            <span>{teamOf(d, champ).name} wins the tournament</span>
          ) : nextUp ? (
            <span>
              <span className="text-neutral-400">{nextUp.label}:</span> {teamOf(d, nextUp.match.a).name} vs {teamOf(d, nextUp.match.b).name}
            </span>
          ) : null}
        </div>
      ) : null}
      {!showLanes ? <EffectBanner now={now} /> : null}
    </div>
  );
}

/* An effect a leader set off from the console, shown over the standings or
   the solo clock: what it is, who it's on, who used it, and how long. */
function EffectBanner({ now }: { now: number }) {
  const d = useApp((s) => s.data);
  const live = liveEffects(d.game, now);
  if (!live.length) return null;
  const groups = new Map<string, typeof live>();
  for (const e of live) groups.set(e.penaltyId + '|' + e.startAt, [...(groups.get(e.penaltyId + '|' + e.startAt) ?? []), e]);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-10 flex flex-col items-center gap-3 px-10">
      {[...groups.values()].slice(-2).map((fx) => {
        const p = d.config.penalties.find((x) => x.id === fx[0].penaltyId);
        if (!p) return null;
        const remain = Math.max(0, Math.ceil(fx[0].sec - (now - fx[0].startAt) / 1000));
        return (
          <div key={fx[0].key} role="status" className="flex w-full max-w-[900px] items-center gap-5 rounded-[22px] px-7 py-5" style={{ background: 'color-mix(in srgb, ' + (p.color ?? '#968ae0') + ' 30%, #06070d)', boxShadow: '0 0 0 1px ' + (p.color ?? '#968ae0') }}>
            <Icon name={'ph-fill ' + (p.icon ?? 'ph-sparkle')} className="text-[52px]" style={{ color: p.color, filter: 'drop-shadow(0 0 16px ' + p.color + ')', animation: EFFECT_ANIM[p.style ?? 'glow'] ?? EFFECT_ANIM.glow }} />
            <div className="min-w-0 flex-1">
              <div className="text-[30px] font-bold uppercase leading-none tracking-[.05em] text-white">
                {p.label} <span className="text-[22px] font-semibold normal-case tracking-normal text-white/85">on {fx.map((e) => teamOf(d, e.teamId).name).join(', ')}</span>
              </div>
              {p.rule ? <div className="mt-2 text-[15px] leading-[1.45] text-white/85">{p.rule}</div> : null}
              {fx[0].by ? <div className="mt-1 text-[13px] font-semibold uppercase tracking-[.08em] text-white/75">{teamOf(d, fx[0].by).name} used it</div> : null}
            </div>
            <div className="tabular rounded-full px-4 py-2 text-[22px] font-semibold leading-none text-white" style={{ background: 'rgba(0,0,0,.35)' }}>
              {remain}s
            </div>
          </div>
        );
      })}
    </div>
  );
}
