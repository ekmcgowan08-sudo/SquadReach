'use client';
/* PLANNER · SETTINGS — the shape every planner view reads: the plan's basics,
   its lanes, the blocks a night is built from, how the year is cut into
   seasons, the debrief questions and the volunteer roles. Changes apply for
   everyone on staff; each is one undo step and lands in Recent changes. */
import Link from 'next/link';
import { useState } from 'react';
import { useSaveConfig } from '@/components/console/kit';
import { PageHead, Panel, Toggle, UndoButtons, usePlanSave } from '@/components/planner/kit';
import { Btn, Icon, cx } from '@/components/ui';
import { advent1, addDays, easter } from '@/lib/liturgical';
import { isoDay } from '@/lib/dates';
import { BLOCK_DEFAULTS, DEBRIEF_DEFAULTS, HUES, LANE_DEFAULTS, SEASON_DEFAULTS, clockOf, laneColor, nightsOf, orderOf, orderTimes, seasonsOf, yearLabel, yearOf, type Plan, type SeasonAnchor, TRANSLATIONS } from '@/lib/plan';
import { uid } from '@/lib/store/app-store';
import { useApp } from '@/lib/store/provider';

const PANELS = [
  { id: 'basics', label: 'Plan basics' },
  { id: 'lanes', label: 'Roadmap lanes' },
  { id: 'blocks', label: 'Gathering blocks' },
  { id: 'seasons', label: 'Seasons' },
  { id: 'debrief', label: 'Debrief questions' },
  { id: 'roles', label: 'Volunteer roles' }
] as const;
type PanelId = (typeof PANELS)[number]['id'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** This year's nights, and which of them run the template rather than an
 *  order of their own — what a change to the blocks actually reaches. */
function templateReach(p: Plan) {
  const today = isoDay(new Date());
  const y = Math.max(0, Math.min(6, yearOf(p, today)));
  const nights = nightsOf(p, y);
  const own = nights.filter((n) => p.gatherings[n]?.order);
  return { y, nights, own, today };
}

export function PlannerSettings() {
  const p = useApp((s) => s.data.plan);
  const roles = useApp((s) => s.data.config.cycle.serveRoles);
  const [panel, setPanel] = useState<PanelId>('basics');
  const counts: Record<PanelId, number | null> = {
    basics: null,
    lanes: p.lanes.filter((l) => l.on).length,
    blocks: p.blocks.filter((b) => b.on).length,
    seasons: p.seasons.filter((x) => x.on).length,
    debrief: p.debriefQs.filter((q) => q.on).length,
    roles: roles.length
  };
  return (
    <>
      <PageHead kicker={p.settings.name} title="Settings" sub="Changes apply for everyone on staff. The season builder wrote the starting values; this is where they live now." right={<UndoButtons />} />
      <div className="grid items-start gap-5 lg:grid-cols-[220px_1fr_300px]">
        <nav className="flex flex-col gap-1" aria-label="Settings">
          {PANELS.map((x) => (
            <button
              key={x.id}
              onClick={() => setPanel(x.id)}
              aria-current={panel === x.id ? 'page' : undefined}
              className="relative flex min-h-10 items-center rounded-md px-3 text-left text-[13.5px] font-medium"
              style={{ background: panel === x.id ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)' : 'transparent', color: panel === x.id ? 'var(--color-accent-100)' : 'var(--color-neutral-400)' }}
            >
              {panel === x.id ? <span aria-hidden className="absolute inset-y-[9px] left-0 w-[3px] rounded-full bg-accent-400" /> : null}
              <span className="flex-1">{x.label}</span>
              {counts[x.id] != null ? <span className="tabular text-[12px] font-normal text-neutral-500">{counts[x.id]}</span> : null}
            </button>
          ))}
          <div className="mt-3 border-t border-divider pt-3 text-[12px] leading-[1.6] text-neutral-500">Every change is one undo step and lands in Recent changes, with who made it.</div>
        </nav>
        <div>
          {panel === 'basics' ? <Basics /> : panel === 'lanes' ? <Lanes /> : panel === 'blocks' ? <Blocks /> : panel === 'seasons' ? <Seasons /> : panel === 'debrief' ? <Debrief /> : <Roles />}
        </div>
        <div className="flex flex-col gap-5">
          {panel === 'blocks' ? <BlocksPreview /> : null}
          <Panel title="Recent changes">
            {!p.changes.length ? <div className="text-[12px] text-neutral-500">Nothing changed yet.</div> : null}
            {p.changes.slice(0, 12).map((c) => (
              <div key={c.id} className="border-t border-divider pt-2 text-[12px] first:border-t-0 first:pt-0">
                <div className="text-neutral-200">{c.line}</div>
                <div className="text-[11px] text-neutral-500">
                  {c.by} · {new Date(c.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
            ))}
            <div className="text-[11px] text-neutral-500">Undo steps back through every change you made this session (⌘Z).</div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Row({ children, off }: { children: React.ReactNode; off?: boolean }) {
  return <div className={cx('grid items-center gap-2 border-t border-divider py-2 first:border-t-0', off && 'opacity-60')}>{children}</div>;
}

function Basics() {
  const p = useApp((s) => s.data.plan);
  const save = usePlanSave();
  const st = p.settings;
  const set = (patch: Partial<typeof st>, line: string, merge?: string) => save((x) => void (x.settings = { ...x.settings, ...patch }), line, { log: true, merge });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  return (
    <Panel
      title="Plan basics"
      meta={yearLabel(st.startYear, 0) + ' – ' + yearLabel(st.startYear, 6)}
      right={
        <Link href="/planner/setup" className="text-[12px] text-accent-300">
          {st.setupAt ? 'Run setup again' : 'Guided setup'}
        </Link>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span className="sr-label">Plan name</span>
          <input className="input" value={st.name} onChange={(e) => set({ name: e.target.value }, 'Renamed the plan', 'plan-name')} />
        </label>
        <label className="field">
          <span className="sr-label">Campus</span>
          <input className="input" value={st.campus} onChange={(e) => set({ campus: e.target.value }, 'Changed the campus', 'campus')} />
        </label>
        <label className="field">
          <span className="sr-label">Year one starts in August of</span>
          <input className="input" type="number" min={2000} max={2100} value={st.startYear} onChange={(e) => Number(e.target.value) > 1999 && set({ startYear: Number(e.target.value) }, 'Moved year one to ' + e.target.value)} />
        </label>
        <label className="field">
          <span className="sr-label">Gathering night</span>
          <select className="input" value={st.gatherDay} onChange={(e) => set({ gatherDay: Number(e.target.value) }, 'Gathering night is now ' + DAYS[Number(e.target.value)])}>
            {DAYS.map((x, i) => (
              <option key={x} value={i}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="sr-label">Students enter in grade</span>
          <input className="input" type="number" min={1} max={12} value={st.entryGrade} onChange={(e) => set({ entryGrade: Math.max(1, Math.min(12, Number(e.target.value) || 6)) }, 'Entry grade is now ' + e.target.value)} />
        </label>
        <label className="field">
          <span className="sr-label">Bible translation</span>
          <select className="input" value={st.translation} onChange={(e) => set({ translation: e.target.value }, 'Translation is now ' + e.target.value)}>
            {TRANSLATIONS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3 border-t border-divider pt-3">
        <Toggle on={st.liturgical} onChange={(v) => set({ liturgical: v }, v ? 'Turned on the church year' : 'Turned off the church year')} label="Church year" />
        <div>
          <div className="text-[13px] text-neutral-100">Show the church year</div>
          <div className="text-[11.5px] text-neutral-500">Advent, Lent, Easter and the rest, on the roadmap and beside each night. Off by default.</div>
        </div>
      </div>
      <div className="border-t border-divider pt-3">
        <div className="sr-label mb-2">Blackout dates — no gathering</div>
        {st.blackouts.map(([a, b], i) => (
          <div key={a + b} className="flex items-center gap-2 py-1 text-[12.5px] text-neutral-200">
            <span className="flex-1">
              {fmt(a)} – {fmt(b)}
            </span>
            <button aria-label="Remove blackout" onClick={() => set({ blackouts: st.blackouts.filter((_, j) => j !== i) }, 'Removed a blackout (' + fmt(a) + ')')} className="h-8 w-8 text-neutral-500">
              <Icon name="ph ph-x" className="text-[12px]" />
            </button>
          </div>
        ))}
        <div className="mt-2 flex flex-wrap gap-2">
          <input className="input !w-auto" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Blackout from" />
          <input className="input !w-auto" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Blackout to" />
          <Btn
            variant="secondary"
            className="px-3"
            disabled={!from}
            onClick={() => {
              const b = to && to >= from ? to : from;
              set({ blackouts: [...st.blackouts, [from, b] as [string, string]].sort((x, y) => x[0].localeCompare(y[0])) }, 'Added a blackout (' + fmt(from) + ')');
              setFrom('');
              setTo('');
            }}
          >
            Add
          </Btn>
        </div>
        <div className="mt-2 text-[11.5px] text-neutral-500">{nightsOf(p, 0).length} gathering nights in {yearLabel(st.startYear, 0)}.</div>
      </div>
    </Panel>
  );
}

const fmt = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function Lanes() {
  const p = useApp((s) => s.data.plan);
  const save = usePlanSave();
  const set = (id: string, patch: Partial<(typeof p.lanes)[number]>, line: string, merge?: string) => save((x) => void (x.lanes = x.lanes.map((l) => (l.id === id ? { ...l, ...patch } : l))), line, { log: true, merge });
  const count = (id: string) => p.items.filter((i) => i.lane === id).length;
  return (
    <Panel title="Roadmap lanes" meta={p.lanes.filter((l) => l.on).length + ' on'} right={<Btn variant="ghost" className="px-3 text-[12px]" onClick={() => window.confirm('Put the twelve standard lanes back? Items keep their lane.') && save((x) => void (x.lanes = LANE_DEFAULTS.map((l) => ({ ...l, ...(x.lanes.find((y) => y.id === l.id) ? { on: true } : {}) })).concat(x.lanes.filter((y) => !LANE_DEFAULTS.some((l) => l.id === y.id)))), 'Reset the lanes', { log: true })}>Reset to preset</Btn>}>
      <div className="text-[12px] leading-[1.5] text-neutral-500">The horizontal tracks of the seven-year plan. A lane you turn off keeps its items but stops appearing on the board. A lane holding items can’t be removed until they’re moved.</div>
      {p.lanes.map((l, i) => (
        <Row key={l.id} off={!l.on}>
          <div className="grid items-center gap-2 sm:grid-cols-[auto_1fr_160px_auto_auto_auto]">
            <button
              aria-label={'Colour of ' + l.name}
              onClick={() => set(l.id, { hue: HUES[(HUES.indexOf(l.hue) + 1) % HUES.length] }, 'Recoloured ' + l.name)}
              className="h-6 w-6 rounded-full border border-neutral-700"
              style={{ background: laneColor(l.hue) }}
            />
            <input className="input !min-h-9 !py-0" value={l.name} onChange={(e) => set(l.id, { name: e.target.value }, 'Renamed a lane to ' + e.target.value, 'lane-name:' + l.id)} aria-label="Lane name" />
            <input className="input !min-h-9 !py-0" value={l.short} onChange={(e) => set(l.id, { short: e.target.value }, 'Short name for ' + l.name, 'lane-short:' + l.id)} aria-label="Short name" />
            <span className="w-[60px] text-right text-[11px] text-neutral-500">{count(l.id)} items</span>
            <div className="flex">
              <button aria-label="Move up" disabled={i === 0} onClick={() => save((x) => void ([x.lanes[i - 1], x.lanes[i]] = [x.lanes[i], x.lanes[i - 1]]), 'Reordered lanes', { log: true })} className="h-9 w-8 text-neutral-400 disabled:opacity-30">
                <Icon name="ph ph-arrow-up" className="text-[12px]" />
              </button>
              <button aria-label="Remove lane" disabled={count(l.id) > 0} title={count(l.id) ? 'Move its items first' : 'Remove'} onClick={() => save((x) => void (x.lanes = x.lanes.filter((y) => y.id !== l.id)), 'Removed the ' + l.name + ' lane', { log: true })} className="h-9 w-8 text-neutral-500 disabled:opacity-30">
                <Icon name="ph ph-trash" className="text-[12px]" />
              </button>
            </div>
            <Toggle on={l.on} onChange={(v) => set(l.id, { on: v }, (v ? 'Showed ' : 'Hid ') + l.name)} label={'Show ' + l.name} />
          </div>
        </Row>
      ))}
      <Btn variant="secondary" className="self-start px-3" onClick={() => save((x) => void x.lanes.push({ id: uid(), name: 'New lane', short: 'New', hue: HUES[x.lanes.length % HUES.length], on: true }), 'Added a lane', { log: true })}>
        + Lane
      </Btn>
    </Panel>
  );
}

function Blocks() {
  const p = useApp((s) => s.data.plan);
  const save = usePlanSave();
  const set = (id: string, patch: Partial<(typeof p.blocks)[number]>, line: string, merge?: string) => save((x) => void (x.blocks = x.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b))), line, { log: true, merge });
  const total = p.blocks.filter((b) => b.on).reduce((n, b) => n + b.mins, 0);
  const { y, nights } = templateReach(p);
  const inUse = (id: string) => nights.filter((n) => orderOf(p, n).some((b) => b.id === id)).length;
  return (
    <Panel title="Gathering blocks" meta={p.blocks.filter((b) => b.on).length + ' of ' + p.blocks.length + ' on · ' + total + ' min a night'} right={<Btn variant="ghost" className="px-3 text-[12px]" onClick={() => save((x) => void (x.blocks = BLOCK_DEFAULTS.map((b) => ({ ...b }))), 'Reset the gathering blocks', { log: true })}>Reset to preset</Btn>}>
      <div className="text-[12px] leading-[1.5] text-neutral-500">The pieces a night is built from, and the template every night starts with. Turn off what you never run; rename anything to match what your team calls it out loud. Nights you already planned keep their own order.</div>
      {p.blocks.map((b, i) => (
        <Row key={b.id} off={!b.on}>
          <div className="grid items-center gap-2 sm:grid-cols-[1fr_1.4fr_110px_70px_auto_auto]">
            <input className="input !min-h-9 !py-0" value={b.name} onChange={(e) => set(b.id, { name: e.target.value }, 'Renamed a block to ' + e.target.value, 'block-name:' + b.id)} aria-label="Block" />
            <input className="input !min-h-9 !py-0" value={b.note} onChange={(e) => set(b.id, { note: e.target.value }, 'Note on ' + b.name, 'block-note:' + b.id)} aria-label="Note" />
            <select className="input !min-h-9 !py-0" value={b.seg} onChange={(e) => set(b.id, { seg: e.target.value as typeof b.seg }, 'Moved ' + b.name)} aria-label="When">
              <option value="pre">Before</option>
              <option value="main">During</option>
              <option value="post">After</option>
            </select>
            <input className="input !min-h-9 !py-0" type="number" min={0} value={b.mins} onChange={(e) => set(b.id, { mins: Math.max(0, Number(e.target.value) || 0) }, b.name + ' length', 'block-mins:' + b.id)} aria-label="Minutes" />
            <button aria-label="Move up" disabled={i === 0} onClick={() => save((x) => void ([x.blocks[i - 1], x.blocks[i]] = [x.blocks[i], x.blocks[i - 1]]), 'Reordered blocks', { log: true })} className="h-9 w-8 text-neutral-400 disabled:opacity-30">
              <Icon name="ph ph-arrow-up" className="text-[12px]" />
            </button>
            <Toggle on={b.on} onChange={(v) => set(b.id, { on: v }, (v ? 'Turned on ' : 'Turned off ') + b.name)} label={'Use ' + b.name} />
          </div>
          <div className="pl-1 text-[11.5px] text-neutral-500">
            {(() => {
              const n = inUse(b.id);
              return !n ? (b.on ? 'Not on any night yet in ' : 'Off · on no nights in ') + yearLabel(p.settings.startYear, y) : n === nights.length ? 'On all ' + n + ' nights in ' + yearLabel(p.settings.startYear, y) : 'On ' + n + ' of ' + nights.length + ' nights in ' + yearLabel(p.settings.startYear, y);
            })()}
          </div>
        </Row>
      ))}
      <Btn variant="secondary" className="self-start px-3" onClick={() => save((x) => void x.blocks.push({ id: uid(), name: 'New block', note: '', mins: 10, seg: 'main', on: true }), 'Added a block', { log: true })}>
        + Block
      </Btn>
    </Panel>
  );
}

/** The template laid on a real night, so a change to the blocks shows where
 *  it lands — and how many nights it reaches. */
function BlocksPreview() {
  const p = useApp((s) => s.data.plan);
  const setupAt = useApp((s) => s.data.config.cycle.setupAt);
  const { nights, own, today } = templateReach(p);
  const ahead = nights.filter((n) => n >= today);
  const night = ahead.find((n) => !p.gatherings[n]?.order) ?? ahead[0] ?? nights[nights.length - 1];
  const onTemplate = night && !p.gatherings[night]?.order;
  const timed = orderTimes(night ? orderOf(p, night) : [], setupAt);
  const total = timed.reduce((n, b) => n + b.mins, 0);
  const off = onTemplate ? p.blocks.filter((b) => !b.on) : [];
  return (
    <>
      <Panel title="Preview" meta="live">
        <div className="text-[12px] leading-[1.5] text-neutral-500">Shown against a real night, so you can see the change land.</div>
        {night ? (
          <div className="flex flex-col rounded-md border border-neutral-800 px-4 py-3">
            <div className="text-[14px] font-medium text-neutral-100">{new Date(night + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            <div className="mb-2 text-[11.5px] text-neutral-500">{onTemplate ? 'Runs the template' : 'Has its own order — the template won’t change it'}</div>
            {timed.map((b) => (
              <div key={b.id} className="grid grid-cols-[52px_1fr_auto] items-start gap-2 py-[5px]">
                <span className="tabular text-[11.5px] text-neutral-500">{clockOf(b.start)}</span>
                <span className="border-l-2 pl-2 text-[12.5px] leading-[1.3] text-neutral-100" style={{ borderColor: b.seg === 'main' ? 'var(--color-accent-400)' : 'var(--color-neutral-700)' }}>
                  {b.kind}
                  {b.lead ? <span className="block text-[11px] text-neutral-500">{b.lead}</span> : null}
                </span>
                <span className="text-[11.5px] text-neutral-500">{b.mins}m</span>
              </div>
            ))}
            {off.map((b) => (
              <div key={b.id} className="grid grid-cols-[52px_1fr_auto] gap-2 py-[5px] text-neutral-600">
                <span />
                <span className="border-l-2 border-neutral-800 pl-2 text-[12.5px] line-through">{b.name}</span>
                <span className="text-[11.5px]">off</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-divider pt-2 text-[12.5px]">
              <span className="text-neutral-400">Total</span>
              <span className="text-neutral-100">
                {Math.floor(total / 60)}h {total % 60}m
              </span>
            </div>
          </div>
        ) : null}
      </Panel>
      <Panel title="Also affected">
        {[
          ['Nights on the template', nights.length - own.length],
          ['Nights with their own order', own.length]
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between border-t border-divider pt-2 text-[12.5px] first:border-t-0 first:pt-0">
            <span className="text-neutral-300">{k}</span>
            <span className="tabular text-neutral-100">{v}</span>
          </div>
        ))}
      </Panel>
    </>
  );
}

function anchorLabel(a: SeasonAnchor): string {
  if (a.kind === 'advent') return 'First Sunday of Advent';
  if (a.kind === 'ash') return 'Ash Wednesday';
  if (a.kind === 'easter') return a.offset === 0 ? 'Easter' : a.offset > 0 ? a.offset + ' days after Easter' : -a.offset + ' days before Easter';
  return new Date(2001, a.month - 1, a.day).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function Seasons() {
  const p = useApp((s) => s.data.plan);
  const save = usePlanSave();
  const res = seasonsOf(p, 0);
  const set = (id: string, patch: Partial<(typeof p.seasons)[number]>, line: string, merge?: string) => save((x) => void (x.seasons = x.seasons.map((s) => (s.id === id ? { ...s, ...patch } : s))), line, { log: true, merge });
  const y = p.settings.startYear;
  return (
    <Panel title="Seasons" meta={'Advent ' + fmt(advent1(y)) + ' · Easter ' + fmt(easter(y + 1))} right={<Btn variant="ghost" className="px-3 text-[12px]" onClick={() => save((x) => void (x.seasons = SEASON_DEFAULTS.map((s) => ({ ...s }))), 'Reset the seasons', { log: true })}>Reset to preset</Btn>}>
      <div className="text-[12px] leading-[1.5] text-neutral-500">How the ministry year is cut. Each season starts on the first gathering night on or after its date, and runs until the next one starts — so Advent and Lent move with the calendar every year.</div>
      {p.seasons.map((s) => {
        const r = res.find((x) => x.id === s.id);
        return (
          <Row key={s.id} off={!s.on}>
            <div className="grid items-center gap-2 sm:grid-cols-[1fr_1.4fr_190px_auto]">
              <input className="input !min-h-9 !py-0" value={s.name} onChange={(e) => set(s.id, { name: e.target.value }, 'Renamed a season to ' + e.target.value, 'season-name:' + s.id)} aria-label="Season" />
              <input className="input !min-h-9 !py-0" value={s.note} onChange={(e) => set(s.id, { note: e.target.value }, 'Note on ' + s.name, 'season-note:' + s.id)} aria-label="Note" />
              <select
                className="input !min-h-9 !py-0"
                value={s.start.kind === 'date' ? 'date:' + s.start.month + '-' + s.start.day : s.start.kind === 'easter' ? 'easter:' + s.start.offset : s.start.kind}
                onChange={(e) => {
                  const v = e.target.value;
                  const start: SeasonAnchor = v === 'advent' ? { kind: 'advent' } : v === 'ash' ? { kind: 'ash' } : v.startsWith('easter:') ? { kind: 'easter', offset: Number(v.slice(7)) } : { kind: 'date', month: Number(v.slice(5).split('-')[0]), day: Number(v.slice(5).split('-')[1]) };
                  set(s.id, { start }, s.name + ' now starts ' + anchorLabel(start));
                }}
                aria-label="Starts"
              >
                <option value="advent">First Sunday of Advent</option>
                <option value="ash">Ash Wednesday</option>
                <option value="easter:0">Easter</option>
                <option value="easter:14">Two weeks after Easter</option>
                {[8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7].map((mo) => (
                  <option key={mo} value={'date:' + mo + '-1'}>
                    {new Date(2001, mo - 1, 1).toLocaleDateString('en-US', { month: 'long' })} 1
                  </option>
                ))}
                {s.start.kind === 'date' && s.start.day !== 1 ? <option value={'date:' + s.start.month + '-' + s.start.day}>{anchorLabel(s.start)}</option> : null}
              </select>
              <Toggle on={s.on} onChange={(v) => set(s.id, { on: v }, (v ? 'Turned on ' : 'Turned off ') + s.name)} label={'Use ' + s.name} />
              <div className="text-[11px] text-neutral-500 sm:col-span-4">{r ? 'This year: ' + fmt(r.from) + ' – ' + fmt(r.to) + ' · ' + r.nights.length + ' nights' : 'Off this year'}</div>
            </div>
          </Row>
        );
      })}
      <Btn variant="secondary" className="self-start px-3" onClick={() => save((x) => void x.seasons.push({ id: uid(), name: 'New season', note: '', start: { kind: 'date', month: 7, day: 1 }, on: true }), 'Added a season', { log: true })}>
        + Season
      </Btn>
      <div className="text-[11px] text-neutral-500">Ash Wednesday this year: {fmt(addDays(easter(y + 1), -46))}.</div>
    </Panel>
  );
}

function Debrief() {
  const p = useApp((s) => s.data.plan);
  const save = usePlanSave();
  const set = (id: string, patch: Partial<(typeof p.debriefQs)[number]>, line: string, merge?: string) => save((x) => void (x.debriefQs = x.debriefQs.map((q) => (q.id === id ? { ...q, ...patch } : q))), line, { log: true, merge });
  return (
    <Panel title="Debrief questions" meta={p.debriefQs.filter((q) => q.on).length + ' asked'} right={<Btn variant="ghost" className="px-3 text-[12px]" onClick={() => save((x) => void (x.debriefQs = DEBRIEF_DEFAULTS.map((q) => ({ ...q }))), 'Reset the debrief questions', { log: true })}>Reset to preset</Btn>}>
      <div className="text-[12px] leading-[1.5] text-neutral-500">Asked after every night, in this order. Keep it to three or four — a debrief people skip is worse than a short one.</div>
      {p.debriefQs.map((q) => (
        <Row key={q.id} off={!q.on}>
          <div className="grid items-center gap-2 sm:grid-cols-[1.3fr_1fr_auto]">
            <input className="input !min-h-9 !py-0" value={q.q} onChange={(e) => set(q.id, { q: e.target.value }, 'Reworded a debrief question', 'q:' + q.id)} aria-label="Question" />
            <input className="input !min-h-9 !py-0" value={q.note} placeholder="A hint under it" onChange={(e) => set(q.id, { note: e.target.value }, 'Hint on a debrief question', 'qn:' + q.id)} aria-label="Hint" />
            <Toggle on={q.on} onChange={(v) => set(q.id, { on: v }, (v ? 'Asked ' : 'Stopped asking ') + '“' + q.q + '”')} label={'Ask ' + q.q} />
          </div>
        </Row>
      ))}
      <Btn variant="secondary" className="self-start px-3" onClick={() => save((x) => void x.debriefQs.push({ id: uid(), q: 'New question', note: '', on: true }), 'Added a debrief question', { log: true })}>
        + Question
      </Btn>
    </Panel>
  );
}

function Roles() {
  const roles = useApp((s) => s.data.config.cycle.serveRoles);
  const saveConfig = useSaveConfig();
  const [draft, setDraft] = useState('');
  const set = (next: string[], note: string) => saveConfig((c) => ({ cycle: { ...c.cycle, serveRoles: next } }), note);
  return (
    <Panel title="Volunteer roles" meta={roles.length + ' a night'}>
      <div className="text-[12px] leading-[1.5] text-neutral-500">The spots the serving schedule fills every night. Volunteers see their own on the phone and ask for swaps there.</div>
      {roles.map((r, i) => (
        <Row key={r}>
          <div className="flex items-center gap-2">
            <span className="flex-1 text-[13px] text-neutral-100">{r}</span>
            <button aria-label="Move up" disabled={i === 0} onClick={() => set(roles.map((x, j) => (j === i - 1 ? r : j === i ? roles[i - 1] : x)), 'Reordered volunteer roles')} className="h-9 w-8 text-neutral-400 disabled:opacity-30">
              <Icon name="ph ph-arrow-up" className="text-[12px]" />
            </button>
            <button aria-label={'Remove ' + r} onClick={() => window.confirm('Remove ' + r + '? Who was scheduled for it stays on file.') && set(roles.filter((x) => x !== r), 'Removed the ' + r + ' role')} className="h-9 w-8 text-neutral-500">
              <Icon name="ph ph-trash" className="text-[12px]" />
            </button>
          </div>
        </Row>
      ))}
      <div className="flex gap-2">
        <input className="input flex-1" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a role — Tech, Prayer team…" aria-label="New role" />
        <Btn
          variant="secondary"
          className="px-3"
          disabled={!draft.trim() || roles.includes(draft.trim())}
          onClick={() => {
            set([...roles, draft.trim()], 'Added the ' + draft.trim() + ' role');
            setDraft('');
          }}
        >
          Add
        </Btn>
      </div>
    </Panel>
  );
}
