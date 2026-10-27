'use client';
/* CONSOLE · LIVE CONTROL — the game night from a laptop: open the room
   screen, set off an effect on it for one squad or several (saying who
   used it), and edit the penalty and bonus effects every squad's game
   timer offers. The room screen only ever shows names, clocks and
   effects, never a control. */
import { useState } from 'react';
import { Blur, Section, useSaveConfig } from '@/components/console/kit';
import { Btn, Icon, cx } from '@/components/ui';
import { emptyLane, liveEffects, withEffect } from '@/lib/game';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import type { Penalty } from '@/lib/types/model';
import { useNow } from '@/lib/use-now';

const LOOKS = [
  { id: 'blur', label: 'Blur / distort' },
  { id: 'chaos', label: 'Shake / wobble' },
  { id: 'glow', label: 'Colour wash / glow' },
  { id: 'scale', label: 'Grow / shrink' },
  { id: 'confetti', label: 'Particle burst' },
  { id: 'flash', label: 'Flash' }
];
const ICONS = ['ph-sparkle', 'ph-snowflake', 'ph-shuffle', 'ph-gauge', 'ph-lightning', 'ph-arrows-in', 'ph-confetti', 'ph-cloud-lightning', 'ph-cloud-fog', 'ph-fire', 'ph-star', 'ph-hand-palm'];
const COLORS = ['#38bdf8', '#f97316', '#968ae0', '#22c55e', '#eab308', '#ec4899', '#facc15', '#64748b'];
const next = <T,>(list: T[], v: T | undefined) => list[(list.indexOf(v as T) + 1) % list.length];

export function LiveTab() {
  const d = useApp((s) => s.data);
  const api = useAppApi();
  const saveConfig = useSaveConfig();
  const penalties = d.config.penalties;
  const [fxId, setFxId] = useState(penalties[0]?.id ?? '');
  const [by, setBy] = useState<string | null>(null);
  const [on, setOn] = useState<string[]>([]);
  const [count, setCount] = useState(false);
  const now = useNow(d.game.effects.length > 0, 1000);
  const live = liveEffects(d.game, now);
  const fx = penalties.find((p) => p.id === fxId);

  const save = (list: Penalty[], note?: string) => saveConfig({ penalties: list }, note);
  const patch = (p: Penalty, change: Partial<Penalty>) => save(penalties.map((x) => (x.id === p.id ? { ...x, ...change } : x)));

  const trigger = () => {
    if (!fx) return api().say('Pick an effect.');
    if (!on.length) return api().say('Pick the squads it applies to.');
    const t = Date.now();
    api().mutate((x) => {
      x.game.effects = withEffect(x.game, fx, on, by, t, uid);
      if (count) {
        for (const id of on) {
          const lane = x.game.lanes[id] ?? emptyLane();
          lane.counts = { ...lane.counts, [fx.id]: (lane.counts[fx.id] ?? 0) + 1 };
          x.game.lanes[id] = lane;
        }
        x.tonight.heatPosted = null;
      }
    });
    api().emit({ kind: 'game', game: api().data.game });
    const names = on.map((id) => d.teams.find((tm) => tm.id === id)?.name ?? id).join(', ');
    api().logActivity(fx.label + ' on ' + names + (by ? ' (used by ' + (d.teams.find((tm) => tm.id === by)?.name ?? by) + ')' : '') + (count ? ', counted on the clock' : ''));
    api().say(fx.label + ' is on the room screen for ' + names + '.');
  };
  const clear = (key: string) => {
    api().mutate((x) => void (x.game.effects = x.game.effects.filter((e) => e.key !== key)));
    api().emit({ kind: 'game', game: api().data.game });
  };

  const chip = (active: boolean) => cx('min-h-11 rounded-full border px-4 text-[13px]', active ? 'border-accent-500 text-accent-100' : 'border-neutral-800 text-neutral-400');

  return (
    <div className="flex flex-col gap-5">
      <section className="sr-dark flex flex-wrap items-center gap-4 rounded-lg px-5 py-4" style={{ background: 'linear-gradient(160deg,var(--color-section) 0%,#1d2044 80%)' }}>
        <Icon name="ph ph-monitor-play" className="text-[22px] text-accent-300" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-medium text-neutral-100">Project to a TV or screen</h2>
          <p className="text-[12.5px] text-neutral-300">The room screen shows squad names, standings, timers and effects — never a score input or any other control.</p>
        </div>
        <a href="/projector" target="_blank" rel="noopener" className="btn btn-secondary min-h-11 px-4">
          Open the room screen
        </a>
      </section>

      <Section title="Trigger live" sub="Set off an effect on the room screen. On the squads’ lanes during a heat, or as a banner over the standings.">
        <div className="flex flex-col gap-2">
          <span className="sr-label">Effect</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Effect">
            {penalties.map((p) => (
              <button key={p.id} aria-pressed={fxId === p.id} onClick={() => setFxId(p.id)} className={cx(chip(fxId === p.id), 'flex items-center gap-2')}>
                <Icon name={'ph-fill ' + (p.icon ?? 'ph-sparkle')} className="text-[14px]" style={{ color: p.color }} />
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="sr-label">Used by (optional)</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Used by">
            <button aria-pressed={by === null} onClick={() => setBy(null)} className={chip(by === null)}>
              No squad — a leader
            </button>
            {d.teams.map((t) => (
              <button key={t.id} aria-pressed={by === t.id} onClick={() => setBy(t.id)} className={chip(by === t.id)}>
                {t.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="sr-label">Applies to</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Applies to">
            {d.teams.map((t) => {
              const a = on.includes(t.id);
              return (
                <button key={t.id} aria-pressed={a} onClick={() => setOn(a ? on.filter((x) => x !== t.id) : [...on, t.id])} className="min-h-11 rounded-full border px-4 text-[13px]" style={{ borderColor: a ? t.color : 'var(--color-neutral-800)', color: a ? 'var(--color-neutral-100)' : 'var(--color-neutral-400)' }}>
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex items-center gap-3 text-[13px] text-neutral-200">
          <input type="checkbox" checked={count} onChange={(e) => setCount(e.target.checked)} />
          Count it on their clock too{fx ? ' (' + (fx.kind === 'subtract' ? '−' : '+') + fx.sec + 's each)' : ''}
        </label>
        <Btn variant="secondary" className="self-start px-4" onClick={trigger}>
          <Icon name="ph ph-lightning" className="mr-[6px] text-[14px]" />
          Trigger on screen
        </Btn>
        {live.length ? (
          <div className="flex flex-col border-t border-divider pt-2">
            <span className="sr-label">On screen now</span>
            {live.map((e) => {
              const p = penalties.find((x) => x.id === e.penaltyId);
              const left = Math.max(0, Math.ceil(e.sec - (now - e.startAt) / 1000));
              return (
                <div key={e.key} className="flex min-h-11 items-center gap-3 text-[13px]">
                  <Icon name={'ph-fill ' + (p?.icon ?? 'ph-sparkle')} className="text-[15px]" style={{ color: p?.color }} />
                  <span className="flex-1 text-neutral-200">
                    {p?.label ?? 'Effect'} on {d.teams.find((t) => t.id === e.teamId)?.name ?? e.teamId}
                    {e.by ? <span className="text-neutral-400"> · used by {d.teams.find((t) => t.id === e.by)?.name}</span> : null}
                  </span>
                  <span className="tabular text-neutral-400">{left}s</span>
                  <Btn variant="ghost" className="px-3" onClick={() => clear(e.key)}>
                    Clear
                  </Btn>
                </div>
              );
            })}
          </div>
        ) : null}
      </Section>

      <Section
        title="Effect & bonus templates"
        sub="The same buttons on every squad’s game timer. A penalty adds time; a bonus takes it off. The look is how the room screen shows it."
        right={
          <Btn className="px-4" onClick={() => save([...penalties, { id: uid(), label: 'Custom effect', sec: 10, kind: 'add', icon: 'ph-sparkle', color: '#968ae0', style: 'glow', rule: '' }], 'Added a custom effect')}>
            <Icon name="ph ph-plus" className="mr-[6px] text-[14px]" />
            Custom effect
          </Btn>
        }
      >
        {penalties.map((p) => (
          <div key={p.id} role="group" aria-label={'Effect: ' + p.label} className="flex flex-col gap-2 rounded-md border border-neutral-800 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <button aria-label={'Change the icon of ' + p.label} title="Change icon" onClick={() => patch(p, { icon: next(ICONS, p.icon) })} className="flex h-11 w-11 flex-none items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, ' + (p.color ?? '#968ae0') + ' 22%, transparent)' }}>
                <Icon name={'ph-fill ' + (p.icon ?? 'ph-sparkle')} className="text-[18px]" style={{ color: p.color }} />
              </button>
              <button aria-label={'Change the colour of ' + p.label} title="Change colour" onClick={() => patch(p, { color: next(COLORS, p.color) })} className="flex h-11 w-7 flex-none items-center justify-center">
                <span className="h-4 w-4 rounded-full" style={{ background: p.color }} />
              </button>
              <Blur label="Name" value={p.label} onSave={(v) => v && patch(p, { label: v })} className="min-w-[150px] flex-1 font-medium" />
              <button onClick={() => patch(p, { kind: p.kind === 'subtract' ? 'add' : 'subtract' })} aria-label={(p.kind === 'subtract' ? 'Bonus · subtracts' : 'Penalty · adds') + ' — ' + p.label + ', switch'} className={cx('min-h-11 rounded-full border px-3 text-[12.5px]', p.kind === 'subtract' ? 'border-accent-600 text-accent-200' : 'border-neutral-700 text-neutral-300')}>
                {p.kind === 'subtract' ? 'Bonus · subtracts' : 'Penalty · adds'}
              </button>
              <select aria-label={'Look of ' + p.label} className="input w-auto" value={p.style ?? 'glow'} onChange={(e) => patch(p, { style: e.target.value })}>
                {LOOKS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <button aria-label={'Fewer seconds for ' + p.label} onClick={() => patch(p, { sec: Math.max(0, p.sec - 5) })} className="flex h-11 w-9 items-center justify-center rounded-md border border-neutral-800 text-neutral-300">
                  −
                </button>
                <span className="tabular w-10 text-center text-[13px] font-semibold text-neutral-100">{p.sec}s</span>
                <button aria-label={'More seconds for ' + p.label} onClick={() => patch(p, { sec: p.sec + 5 })} className="flex h-11 w-9 items-center justify-center rounded-md border border-accent-700 text-accent-200">
                  +
                </button>
              </div>
              <button aria-label={'Delete ' + p.label} onClick={() => window.confirm('Delete “' + p.label + '”? Counts already on tonight’s clock stop counting.') && save(penalties.filter((x) => x.id !== p.id), 'Deleted the effect ' + p.label)} className="flex h-11 w-11 items-center justify-center rounded-md border border-neutral-800 text-neutral-500 hover:text-neutral-200">
                <Icon name="ph ph-trash" className="text-[15px]" />
              </button>
            </div>
            <Blur area label={'What the squad does: ' + p.label} value={p.rule ?? ''} placeholder="What the squad has to do while it’s on" onSave={(v) => patch(p, { rule: v })} />
          </div>
        ))}
      </Section>
    </div>
  );
}
