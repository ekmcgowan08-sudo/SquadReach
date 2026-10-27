'use client';
/* The game's shape and its housekeeping, in Console › Scoring: rounds,
   quarters or halves and how each ends, how it's scored, the target and
   players on the field; where it's played (places the ministry names
   join its list); who reads the rules; and games kept to run again. */
import { useState } from 'react';
import { AUDIENCE_LABELS } from '@/components/screens/calendar';
import { Btn, Icon, cx } from '@/components/ui';
import { ENDS, SCORING, SEGMENTS, formatOf, formatSummary, type GameFormat } from '@/lib/game-format';
import { ALL_AUDIENCES } from '@/lib/selectors';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import type { GameSetup, MinistryConfig } from '@/lib/types/model';
import { useSaveConfig } from '@/components/console/kit';

export const DEFAULT_SPACES = ['Gym Court', 'Outdoor field', 'Parking lot', 'Fellowship hall', 'Classroom', 'Offsite'];

const chip = (on: boolean) => cx('min-h-11 rounded-full border px-4 text-[12.5px] font-medium', on ? 'border-accent-500 text-accent-100' : 'border-neutral-800 text-neutral-400');

function Stepper({ label, value, onChange, min = 0, max = 99, empty }: { label: string; value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; empty?: string }) {
  return (
    <div className="field">
      <span className="sr-label">{label}</span>
      <div className="flex items-center gap-2">
        <button aria-label={'Less: ' + label} onClick={() => onChange(value === null ? null : value - 1 < min ? (empty ? null : min) : value - 1)} className="flex h-11 w-11 items-center justify-center rounded-md border border-neutral-800 text-neutral-300">
          −
        </button>
        <span className="tabular min-w-12 text-center text-[15px] font-medium text-neutral-100">{value ?? empty ?? min}</span>
        <button aria-label={'More: ' + label} onClick={() => onChange(Math.min(max, (value ?? min - 1) + 1))} className="flex h-11 w-11 items-center justify-center rounded-md border border-accent-700 text-accent-200">
          +
        </button>
      </div>
    </div>
  );
}

export function GameFormatEditor() {
  const gs = useApp((s) => s.data.config.gameSetup);
  const save = useSaveConfig();
  const f = formatOf(gs.format);
  const set = (patch: Partial<GameFormat>, note?: string) => save((c) => ({ gameSetup: { ...c.gameSetup, format: { ...formatOf(c.gameSetup.format), ...patch } } }), note);
  const one = SEGMENTS.find((s) => s.id === f.segment)!;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <span className="sr-label">Segments per game</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Segments per game">
          {SEGMENTS.map((s) => (
            <button key={s.id} aria-pressed={f.segment === s.id} onClick={() => set({ segment: s.id }, 'Game format: ' + s.label.toLowerCase())} className={chip(f.segment === s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        {f.segment !== 'continuous' && f.segment !== 'halves' ? <Stepper label={'How many ' + one.label.toLowerCase()} value={f.count} min={1} max={12} onChange={(v) => set({ count: v ?? 1 })} /> : null}
        {f.ends === 'clock' ? <Stepper label={f.segment === 'continuous' ? 'Minutes in the game' : 'Minutes per ' + one.one.toLowerCase()} value={f.minutes} min={1} max={120} onChange={(v) => set({ minutes: v ?? 1 })} /> : null}
        <Stepper label="Points to win" value={f.toWin} min={1} max={999} empty="—" onChange={(v) => set({ toWin: v })} />
        <Stepper label="Players on the field" value={f.maxPlayers} min={1} max={99} empty="—" onChange={(v) => set({ maxPlayers: v })} />
      </div>
      {f.segment !== 'continuous' ? (
        <div className="flex flex-col gap-2">
          <span className="sr-label">What ends a {one.one.toLowerCase()}?</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label={'What ends a ' + one.one.toLowerCase()}>
            {ENDS.map((e) => (
              <button key={e.id} aria-pressed={f.ends === e.id} onClick={() => set({ ends: e.id })} className={chip(f.ends === e.id)}>
                {e.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <span className="sr-label">How you score points</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="How you score points">
          {SCORING.map((s) => (
            <button key={s.id} aria-pressed={f.scoring === s.id} onClick={() => set({ scoring: s.id })} className={chip(f.scoring === s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[12.5px] text-neutral-300">
        <Icon name="ph ph-info" className="mr-1 text-[13px] text-accent-300" />
        {formatSummary(f)}. Players see this on Game rules; the recorder names its periods by it.
      </p>
    </div>
  );
}

export function GamePlaces() {
  const c = useApp((s) => s.data.config);
  const save = useSaveConfig();
  const [name, setName] = useState('');
  const gs = c.gameSetup;
  const spaces = c.savedSpaces ?? DEFAULT_SPACES;
  const pick = (sp: string) => save((cc) => ({ gameSetup: { ...cc.gameSetup, fieldTypes: cc.gameSetup.fieldTypes.includes(sp) ? cc.gameSetup.fieldTypes : [...cc.gameSetup.fieldTypes, sp] } }));
  const add = () => {
    const sp = name.trim().replace(/\s+/g, ' ');
    if (!sp) return;
    save((cc) => {
      const list = cc.savedSpaces ?? DEFAULT_SPACES;
      return { savedSpaces: list.some((x) => x.toLowerCase() === sp.toLowerCase()) ? list : [...list, sp], gameSetup: { ...cc.gameSetup, fieldTypes: cc.gameSetup.fieldTypes.includes(sp) ? cc.gameSetup.fieldTypes : [...cc.gameSetup.fieldTypes, sp] } };
    }, 'Saved the place ' + sp);
    setName('');
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="sr-label">Where it’s played (a game can use more than one place)</span>
      <div className="flex flex-wrap items-end gap-2">
        <label className="field min-w-[200px]">
          <span className="sr-label">Pick a saved place</span>
          <select className="input" value="" onChange={(e) => e.target.value && pick(e.target.value)}>
            <option value="">Choose from your places…</option>
            {spaces
              .filter((sp) => !gs.fieldTypes.includes(sp))
              .map((sp) => (
                <option key={sp}>{sp}</option>
              ))}
          </select>
        </label>
        <label className="field min-w-[200px] flex-1">
          <span className="sr-label">Or type a new one</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="North gym" />
        </label>
        <Btn variant="secondary" className="px-4" onClick={add} disabled={!name.trim()}>
          Save place
        </Btn>
      </div>
      <p className="text-[11.5px] text-neutral-500">A place you save joins the list for every game after this one.</p>
      <div className="flex flex-wrap gap-2">
        {gs.fieldTypes.map((sp) => (
          <span key={sp} className="flex min-h-11 items-center gap-1 rounded-full border border-accent-600 pl-4 pr-1 text-[12.5px] text-accent-100">
            {sp}
            <button aria-label={'Remove ' + sp + ' from this game'} onClick={() => save((cc) => ({ gameSetup: { ...cc.gameSetup, fieldTypes: cc.gameSetup.fieldTypes.filter((x) => x !== sp) } }))} className="flex h-9 w-9 items-center justify-center rounded-full text-accent-200">
              <Icon name="ph ph-x" className="text-[12px]" />
            </button>
          </span>
        ))}
        {!gs.fieldTypes.length ? <span className="text-[12.5px] text-neutral-500">No place picked yet.</span> : null}
      </div>
    </div>
  );
}

export function RulesAudience() {
  const gs = useApp((s) => s.data.config.gameSetup);
  const save = useSaveConfig();
  const all = !gs.rulesAudience?.length;
  const toggle = (a: (typeof ALL_AUDIENCES)[number]) => {
    const cur = gs.rulesAudience?.length ? gs.rulesAudience : [...ALL_AUDIENCES];
    const next = cur.includes(a) ? cur.filter((x) => x !== a) : ALL_AUDIENCES.filter((x) => x === a || cur.includes(x));
    save((cc) => ({ gameSetup: { ...cc.gameSetup, rulesAudience: next.length === ALL_AUDIENCES.length ? null : next } }));
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="sr-label">The rules are visible to</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label="The rules are visible to">
        {ALL_AUDIENCES.map((a) => {
          const on = all || !!gs.rulesAudience?.includes(a);
          return (
            <button key={a} aria-pressed={on} onClick={() => toggle(a)} className={chip(on)}>
              {AUDIENCE_LABELS[a].label}
            </button>
          );
        })}
      </div>
      <p className="text-[11.5px] text-neutral-500">Leaders always see them. Anyone else outside this list sees when and where, and that the rules are coming.</p>
    </div>
  );
}

export function GameTemplates() {
  const c = useApp((s) => s.data.config);
  const api = useAppApi();
  const save = useSaveConfig();
  const list = c.gameTemplates ?? [];
  const keep = () => {
    const name = c.gameName || 'Game';
    save((cc) => ({ gameTemplates: [{ id: uid(), name, setup: JSON.parse(JSON.stringify(cc.gameSetup)) as GameSetup }, ...(cc.gameTemplates ?? []).filter((t) => t.name !== name)] }), 'Saved the game ' + name + ' to run again');
    api().say(name + ' is saved — load it for any later game.');
  };
  const load = (id: string) => {
    const t = list.find((x) => x.id === id);
    if (!t || !window.confirm('Load “' + t.name + '”? This game’s rules, format, places and map are replaced; its weeks stay as they are.')) return;
    save((cc): Partial<MinistryConfig> => ({ gameName: t.name, gameSetup: { ...(JSON.parse(JSON.stringify(t.setup)) as GameSetup), gameWeeks: cc.gameSetup.gameWeeks } }), 'Loaded the game ' + t.name);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Btn variant="secondary" className="px-4" onClick={keep}>
        <Icon name="ph ph-bookmark-simple" className="mr-[6px] text-[14px]" />
        Save this game to run again
      </Btn>
      {list.length ? (
        <label className="field">
          <span className="sr-label">Load a saved game</span>
          <select className="input" value="" onChange={(e) => e.target.value && load(e.target.value)}>
            <option value="">{list.length === 1 ? '1 saved game' : list.length + ' saved games'}</option>
            {list.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
