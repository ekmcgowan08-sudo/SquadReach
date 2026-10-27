'use client';
/* PLANNER · SETUP — the seven-year plan's first run, in six short steps:
   the range, who's in it, the week and its breaks, what the church
   believes, the lanes and goals, and a review. Nothing is locked; every
   answer stays editable in Settings, and creating it is one undo step. */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSaveConfig } from '@/components/console/kit';
import { PageHead, Toggle, usePlanSave } from '@/components/planner/kit';
import { Btn, Icon, cx } from '@/components/ui';
import { LANE_DEFAULTS, TRADITIONS, TRANSLATIONS, laneColor, nightsOf, yearLabel, type PlanLane } from '@/lib/plan';
import { nowMs } from '@/lib/dates';
import { DEFAULT_ZONE, ZONES } from '@/lib/time-zone';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';

const STEPS = [
  { key: 'basics', short: 'Basics', title: 'Name the plan and its seven years', blurb: 'Everything else hangs off this range. Seven years is one full pass from sixth grade to graduation — change the start and the whole plan shifts with it.' },
  { key: 'groups', short: 'Groups', title: 'Who is in the plan', blurb: 'Use the groups you already run. Grades drive cohorts, and cohorts are how the planner knows what a class has already received.' },
  { key: 'rhythm', short: 'Rhythm', title: 'Your week, and when you don’t meet', blurb: 'The night you gather and the breaks you take. Nothing schedules onto a break, and a series paused by one resumes without losing a week.' },
  { key: 'identity', short: 'Identity', title: 'What your church believes', blurb: 'This shapes suggestions and the passages they cite. Nothing here is used to publish anything on its own.' },
  { key: 'lanes', short: 'Lanes', title: 'Lanes, goals, outcomes', blurb: 'Lanes are the tracks the board is drawn in. Turn off what you don’t run and rename anything.' },
  { key: 'review', short: 'Review', title: 'Check it over', blurb: 'Every one of these stays editable in plan settings after the plan exists.' }
] as const;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ord = (g: number) => g + (g === 1 ? 'st' : g === 2 ? 'nd' : g === 3 ? 'rd' : 'th');

interface Draft {
  name: string;
  campus: string;
  startYear: number;
  /** The ministry's clock: report deliveries and reminders run on it. */
  timeZone: string;
  groups: { id: string; name: string; low: number; high: number }[];
  gatherDay: number;
  breaks: { id: string; label: string; from: string; to: string }[];
  church: string;
  denomination: string;
  tradition: string;
  translation: string;
  doctrine: string;
  values: string;
  liturgical: boolean;
  lanes: PlanLane[];
  goals: { id: string; text: string }[];
  outcomes: { id: string; text: string }[];
}

function draftFrom(fallback: { name: string; year: number }): Draft {
  const y = fallback.year;
  return {
    name: fallback.name,
    campus: 'Main campus',
    startYear: y,
    timeZone: DEFAULT_ZONE,
    groups: [
      { id: 'g1', name: 'Middle school', low: 6, high: 8 },
      { id: 'g2', name: 'High school', low: 9, high: 12 }
    ],
    gatherDay: 3,
    breaks: [
      { id: 'b1', label: 'Thanksgiving', from: y + '-11-23', to: y + '-11-29' },
      { id: 'b2', label: 'Christmas', from: y + '-12-20', to: y + 1 + '-01-03' },
      { id: 'b3', label: 'Spring break', from: y + 1 + '-03-14', to: y + 1 + '-03-21' }
    ],
    church: '',
    denomination: '',
    tradition: 'Not specified',
    translation: 'KJV',
    doctrine: '',
    values: '',
    liturgical: false,
    lanes: LANE_DEFAULTS.map((l) => ({ ...l })),
    goals: [{ id: 'o1', text: 'Every student in a small group by the end of ninth grade' }],
    outcomes: [
      { id: 'x1', text: 'Can explain the gospel in their own words' },
      { id: 'x2', text: 'Has read in every part of the Bible' },
      { id: 'x3', text: 'Has served someone outside the church' }
    ]
  };
}

export function PlanSetup() {
  const p = useApp((s) => s.data.plan);
  const ministry = useApp((s) => s.data.config.ministryName);
  const zone = useApp((s) => s.data.config.timeZone);
  const saveConfig = useSaveConfig();
  const api = useAppApi();
  const save = usePlanSave();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  /* Start from what the plan already holds; defaults fill only what it doesn't. */
  const [d, setD] = useState<Draft>(() => {
    const st = p.settings;
    const base = draftFrom({ name: st.name && st.name !== 'Seven-year plan' ? st.name : ministry + ' · seven-year plan', year: st.startYear });
    return {
      ...base,
      campus: st.campus || base.campus,
      timeZone: zone || base.timeZone,
      groups: st.groups ? st.groups.map((g, i) => ({ ...g, id: 'g' + i })) : st.entryGrade !== 6 ? [{ id: 'g0', name: 'Students', low: st.entryGrade, high: 12 }] : base.groups,
      gatherDay: st.gatherDay,
      breaks: st.blackouts.length ? st.blackouts.map(([from, to], i) => ({ id: 'b' + i, label: 'Break ' + (i + 1), from, to })) : base.breaks,
      church: st.church ?? '',
      denomination: st.denomination ?? '',
      tradition: st.tradition ?? base.tradition,
      translation: st.translation,
      doctrine: st.doctrine ?? '',
      values: st.values ?? '',
      liturgical: st.liturgical,
      lanes: p.lanes.map((l) => ({ ...l })),
      goals: p.items.some((i) => i.kind === 'goal') ? [] : base.goals,
      outcomes: st.outcomes ? st.outcomes.map((text, i) => ({ id: 'x' + i, text })) : base.outcomes
    };
  });
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const rows = <K extends 'groups' | 'breaks' | 'goals' | 'outcomes'>(k: K, fn: (l: Draft[K]) => Draft[K]) => setD((x) => ({ ...x, [k]: fn(x[k]) }));

  const entry = Math.min(...d.groups.map((g) => g.low), 12);
  const exit = Math.max(...d.groups.map((g) => g.high), entry);
  const blockFor = (i: number): string | null => {
    if (i === 0 && !d.name.trim()) return 'The plan needs a name.';
    if (i === 1 && !d.groups.length) return 'Add at least one group — the plan needs someone to be for.';
    if (i === 1 && d.groups.some((g) => g.high < g.low)) return 'One group ends at a lower grade than it starts.';
    if (i === 2 && d.breaks.some((b) => !b.from || !b.to || b.to < b.from)) return 'Each break needs a first and last date, in that order.';
    if (i === 4 && !d.lanes.some((l) => l.on)) return 'Keep at least one lane on — the board is drawn in lanes.';
    return null;
  };
  const blocked = STEPS.map((_, i) => blockFor(i)).find(Boolean) ?? null;
  const nights = nightsOf({ ...p, settings: { ...p.settings, startYear: d.startYear, gatherDay: d.gatherDay, blackouts: d.breaks.map((b) => [b.from, b.to] as [string, string]) } }, 0).length;

  const create = () => {
    save(
      (x) => {
        x.settings = {
          ...x.settings,
          name: d.name.trim(),
          campus: d.campus.trim(),
          startYear: d.startYear,
          gatherDay: d.gatherDay,
          entryGrade: entry,
          blackouts: d.breaks.map((b) => [b.from, b.to] as [string, string]).sort((a, b) => a[0].localeCompare(b[0])),
          liturgical: d.liturgical,
          translation: d.translation,
          groups: d.groups.map(({ name, low, high }) => ({ name: name.trim() || ord(low) + '–' + ord(high), low, high })),
          church: d.church.trim(),
          denomination: d.denomination.trim(),
          tradition: d.tradition,
          doctrine: d.doctrine.trim(),
          values: d.values.trim(),
          outcomes: d.outcomes.map((o) => o.text.trim()).filter(Boolean),
          setupAt: nowMs()
        };
        x.lanes = d.lanes;
        for (const g of d.goals.filter((o) => o.text.trim())) x.items.push({ id: uid(), lane: 'goals', year: 0, title: g.text.trim(), kind: 'goal', size: 12, status: 'confirmed', notes: 'From the plan setup.', tags: [], supports: [] });
      },
      p.settings.setupAt ? 'Run the plan setup again' : 'Set up the plan',
      { log: true }
    );
    if (d.timeZone !== (zone || DEFAULT_ZONE)) saveConfig({ timeZone: d.timeZone }, 'Time zone is now ' + d.timeZone);
    api().logActivity('Set up the seven-year plan · ' + yearLabel(d.startYear, 0) + ' – ' + yearLabel(d.startYear, 6));
    setDone(true);
  };

  if (done)
    return (
      <div className="mx-auto flex max-w-[720px] flex-col gap-5 py-6">
        <PageHead kicker="Setup complete" title={d.name} sub={yearLabel(d.startYear, 0) + ' – ' + yearLabel(d.startYear, 6) + ' · ' + DAYS[d.gatherDay] + ' nights · ' + ord(entry) + ' through ' + ord(exit) + ' grade'} />
        {[
          { n: '01', t: 'Open the roadmap', b: 'Seven years at a glance. Name a theme per year before you touch a single week.', href: '/planner/roadmap' },
          { n: '02', t: 'Build the teaching frame', b: 'Add the series you already know you’ll teach. Suggestions fill gaps with dashed drafts you confirm.', href: '/planner/roadmap?view=suggestions' },
          { n: '03', t: 'Plan the first year by month', b: 'Drag items onto months on the ministry-year board; series land on gathering nights and skip the breaks you set.', href: '/planner/year' }
        ].map((s) => (
          <button key={s.n} onClick={() => router.push(s.href)} className="sr-card flex items-start gap-4 px-5 py-4 text-left">
            <span className="text-[22px] font-medium tabular-nums text-accent-300">{s.n}</span>
            <span className="flex-1">
              <span className="block text-[15px] font-medium text-neutral-100">{s.t}</span>
              <span className="text-[12.5px] leading-[1.5] text-neutral-400">{s.b}</span>
            </span>
            <Icon name="ph ph-arrow-right" className="mt-1 text-[15px] text-neutral-500" />
          </button>
        ))}
        <Btn variant="ghost" className="self-start px-3 text-[12px]" href="/planner/settings">
          Change a setting
        </Btn>
      </div>
    );

  const S = STEPS[step];
  const block = blockFor(step);
  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-5">
      <PageHead kicker={'Seven-year plan · setup · step ' + (step + 1) + ' of ' + STEPS.length} title={S.title} sub={S.blurb} />
      <div className="flex flex-wrap gap-1">
        {STEPS.map((s, i) => (
          <button key={s.key} onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined} className={cx('flex min-h-8 items-center gap-[6px] rounded-full border px-3 text-[12px]', i === step ? 'border-accent-500 text-accent-100' : 'border-neutral-800 text-neutral-400')}>
            {i < step && !blockFor(i) ? <Icon name="ph ph-check" className="text-[11px]" /> : <span className="tabular-nums">{i + 1}</span>}
            {s.short}
          </button>
        ))}
      </div>

      <div className="sr-card flex flex-col gap-4 px-6 py-5">
        {S.key === 'basics' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Plan name">
              <input className="input" value={d.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
            </Field>
            <Field label="Ministry or campus">
              <input className="input" value={d.campus} onChange={(e) => set({ campus: e.target.value })} />
            </Field>
            <Field label="First ministry year starts in August of">
              <select className="input" value={d.startYear} onChange={(e) => set({ startYear: Number(e.target.value) })}>
                {[-1, 0, 1, 2, 3].map((k) => {
                  const y = p.settings.startYear + k;
                  return (
                    <option key={y} value={y}>
                      {y} · runs {yearLabel(y, 0)} – {yearLabel(y, 6)}
                    </option>
                  );
                })}
              </select>
            </Field>
            <Field label="Time zone">
              <select className="input" value={d.timeZone} onChange={(e) => set({ timeZone: e.target.value })}>
                {[...new Set([d.timeZone, ...ZONES])].map((z) => (
                  <option key={z} value={z}>
                    {z.split('/').pop()!.replace(/_/g, ' ')} · {z}
                  </option>
                ))}
              </select>
            </Field>
            <div className="rounded-md bg-neutral-900 px-4 py-3 md:col-span-2">
              <div className="text-[13.5px] font-medium text-neutral-100">Range</div>
              <div className="mt-1 text-[13px] leading-[1.55] text-neutral-400">
                Seven ministry years, August {d.startYear} through July {d.startYear + 7}. A{entry === 8 || entry === 11 ? 'n' : ''} {ord(entry)} grader starting in year one {exit - entry >= 6 ? 'graduates at the end of it' : 'moves on after ' + ord(exit) + ' grade, in year ' + (exit - entry + 1)}. Reminders and report emails run on {d.timeZone.split('/').pop()!.replace(/_/g, ' ')} time.
              </div>
            </div>
          </div>
        ) : null}

        {S.key === 'groups' ? (
          <>
            {d.groups.map((g) => (
              <div key={g.id} className="grid items-end gap-3 md:grid-cols-[1fr_120px_120px_auto]">
                <Field label="Group">
                  <input className="input" value={g.name} onChange={(e) => rows('groups', (l) => l.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x)))} />
                </Field>
                <Field label="From">
                  <select className="input" value={g.low} onChange={(e) => rows('groups', (l) => l.map((x) => (x.id === g.id ? { ...x, low: Number(e.target.value) } : x)))}>
                    {[5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                      <option key={n} value={n}>
                        {ord(n)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="To">
                  <select className="input" value={g.high} onChange={(e) => rows('groups', (l) => l.map((x) => (x.id === g.id ? { ...x, high: Number(e.target.value) } : x)))}>
                    {[5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                      <option key={n} value={n}>
                        {ord(n)}
                      </option>
                    ))}
                  </select>
                </Field>
                <button aria-label={'Remove ' + g.name} onClick={() => rows('groups', (l) => l.filter((x) => x.id !== g.id))} className="mb-1 flex h-10 w-10 items-center justify-center rounded-full text-neutral-500">
                  <Icon name="ph ph-x" className="text-[14px]" />
                </button>
              </div>
            ))}
            <button onClick={() => rows('groups', (l) => [...l, { id: uid(), name: 'New group', low: exit < 12 ? exit + 1 : 12, high: 12 }])} className="self-start text-[12.5px] text-accent-300">
              + Add a group
            </button>
            <div className="border-t border-divider pt-3 text-[12.5px] leading-[1.5] text-neutral-400">
              Students enter at {ord(entry)} grade and graduate after {ord(exit)}. Classes move up a grade each August with the ministry year. A student who joins late or leaves early is read against the years they were here.
            </div>
          </>
        ) : null}

        {S.key === 'rhythm' ? (
          <>
            <Field label="Weekly gathering night">
              <div className="flex flex-wrap gap-1">
                {DAYS.map((day, i) => (
                  <button key={day} onClick={() => set({ gatherDay: i })} aria-pressed={d.gatherDay === i} className={cx('min-h-9 rounded-full border px-3 text-[12.5px]', d.gatherDay === i ? 'border-accent-500 bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] text-accent-100' : 'border-neutral-800 text-neutral-400')}>
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </Field>
            <div className="flex flex-col gap-2">
              <span className="sr-label">Breaks in year one · nothing schedules onto these</span>
              {d.breaks.map((b) => (
                <div key={b.id} className="grid items-center gap-2 md:grid-cols-[1fr_160px_160px_auto]">
                  <input className="input" value={b.label} aria-label="Break" onChange={(e) => rows('breaks', (l) => l.map((x) => (x.id === b.id ? { ...x, label: e.target.value } : x)))} />
                  <input className="input" type="date" value={b.from} aria-label="First date" onChange={(e) => rows('breaks', (l) => l.map((x) => (x.id === b.id ? { ...x, from: e.target.value } : x)))} />
                  <input className="input" type="date" value={b.to} aria-label="Last date" onChange={(e) => rows('breaks', (l) => l.map((x) => (x.id === b.id ? { ...x, to: e.target.value } : x)))} />
                  <button aria-label={'Remove ' + b.label} onClick={() => rows('breaks', (l) => l.filter((x) => x.id !== b.id))} className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-500">
                    <Icon name="ph ph-x" className="text-[14px]" />
                  </button>
                </div>
              ))}
              <button onClick={() => rows('breaks', (l) => [...l, { id: uid(), label: 'New break', from: '', to: '' }])} className="self-start text-[12.5px] text-accent-300">
                + Add a break
              </button>
            </div>
            <div className="border-t border-divider pt-3 text-[13px] text-neutral-300">
              That gives you <span className="font-medium text-neutral-100">{blockFor(2) ? '…' : nights}</span> {DAYS[d.gatherDay]} nights in {yearLabel(d.startYear, 0)}. Later years get their breaks in Settings as the calendar firms up.
            </div>
          </>
        ) : null}

        {S.key === 'identity' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Church or organization">
              <input className="input" value={d.church} onChange={(e) => set({ church: e.target.value })} />
            </Field>
            <Field label="Denomination">
              <input className="input" value={d.denomination} onChange={(e) => set({ denomination: e.target.value })} />
            </Field>
            <Field label="Theological tradition">
              <select className="input" value={d.tradition} onChange={(e) => set({ tradition: e.target.value })}>
                {TRADITIONS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Preferred Bible translation">
              <select className="input" value={d.translation} onChange={(e) => set({ translation: e.target.value })}>
                {TRANSLATIONS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Doctrinal priorities">
              <textarea className="input min-h-[76px] py-2" value={d.doctrine} onChange={(e) => set({ doctrine: e.target.value })} />
            </Field>
            <Field label="Ministry values">
              <textarea className="input min-h-[76px] py-2" value={d.values} onChange={(e) => set({ values: e.target.value })} />
            </Field>
            <div className="flex items-start gap-3 md:col-span-2">
              <Toggle on={d.liturgical} onChange={(v) => set({ liturgical: v })} label="Use the liturgical calendar" />
              <div>
                <div className="text-[13px] text-neutral-100">Use the liturgical calendar</div>
                <div className="text-[12px] leading-[1.5] text-neutral-500">Adds Advent, Lent, Easter and the rest as an optional layer over the plan. You choose which days you keep.</div>
              </div>
            </div>
          </div>
        ) : null}

        {S.key === 'lanes' ? (
          <>
            <div className="grid gap-2 md:grid-cols-2">
              {d.lanes.map((l) => (
                <div key={l.id} className="flex items-center gap-2">
                  <span className="h-3 w-3 flex-none rounded-full" style={{ background: laneColor(l.hue), opacity: l.on ? 1 : 0.3 }} />
                  <input className={cx('input flex-1', !l.on && 'opacity-50')} value={l.name} aria-label="Lane name" onChange={(e) => set({ lanes: d.lanes.map((x) => (x.id === l.id ? { ...x, name: e.target.value } : x)) })} />
                  <Toggle on={l.on} onChange={(v) => set({ lanes: d.lanes.map((x) => (x.id === l.id ? { ...x, on: v } : x)) })} label={'Show ' + l.name} />
                </div>
              ))}
            </div>
            <ListEdit title="Ministry goals" hint="Each becomes a goal on the roadmap. A goal with nothing supporting it is flagged in Checks." items={d.goals} onChange={(goals) => set({ goals })} add="Add a goal" />
            <ListEdit title="Desired graduate outcomes" hint="What should be true of a student the summer after twelfth grade? Coverage is read against these." items={d.outcomes} onChange={(outcomes) => set({ outcomes })} add="Add an outcome" />
          </>
        ) : null}

        {S.key === 'review' ? (
          <div className="flex flex-col">
            {(
              [
                ['Plan', d.name + (d.campus ? ' · ' + d.campus : ''), 0],
                ['Years', yearLabel(d.startYear, 0) + ' – ' + yearLabel(d.startYear, 6), 0],
                ['Groups', d.groups.map((g) => g.name + ' ' + ord(g.low) + '–' + ord(g.high)).join(', ') || 'none', 1],
                ['Gathers', DAYS[d.gatherDay] + 's · ' + nights + ' nights in year one', 2],
                ['Breaks', d.breaks.map((b) => b.label).join(', ') || 'none', 2],
                ['Tradition', [d.tradition, d.denomination, d.translation].filter(Boolean).join(' · ') + (d.liturgical ? ' · church year on' : ''), 3],
                ['Lanes', d.lanes.filter((l) => l.on).length + ' of ' + d.lanes.length + ' on', 4],
                ['Goals', d.goals.length ? d.goals.length + '' : 'none', 4],
                ['Outcomes', d.outcomes.length ? d.outcomes.length + '' : 'none', 4]
              ] as const
            ).map(([k, v, s]) => (
              <div key={k} className="flex items-baseline gap-4 border-t border-divider py-[9px] first:border-t-0">
                <span className="w-[90px] flex-none text-[12px] text-neutral-500">{k}</span>
                <span className="flex-1 text-[13px] text-neutral-100">{v}</span>
                <button onClick={() => setStep(s)} className="text-[12px] text-accent-300">
                  Edit
                </button>
              </div>
            ))}
            {p.items.length ? <div className="mt-2 text-[12px] leading-[1.5] text-neutral-500">Every item already on the roadmap stays. This changes the settings and adds any goals listed here.</div> : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <Btn variant="ghost" className="px-4" onClick={() => (step ? setStep(step - 1) : router.push('/planner/roadmap'))}>
          {step ? 'Back' : 'Cancel'}
        </Btn>
        <span className="flex-1 text-[12px] text-neutral-500">{step === STEPS.length - 1 ? (blocked ?? 'Settings stay editable afterwards.') : (block ?? '')}</span>
        {step === STEPS.length - 1 ? (
          <Btn className="px-5" disabled={!!blocked} onClick={create}>
            {p.settings.setupAt || p.items.length ? 'Save the plan' : 'Create the plan'}
          </Btn>
        ) : (
          <Btn className="px-5" disabled={!!block} onClick={() => setStep(step + 1)}>
            Continue
          </Btn>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="sr-label">{label}</span>
      {children}
    </label>
  );
}

function ListEdit({ title, hint, items, onChange, add }: { title: string; hint: string; items: { id: string; text: string }[]; onChange: (l: { id: string; text: string }[]) => void; add: string }) {
  return (
    <div className="flex flex-col gap-2 border-t border-divider pt-4">
      <span className="sr-label">{title}</span>
      <span className="text-[12px] leading-[1.5] text-neutral-500">{hint}</span>
      {items.map((o) => (
        <div key={o.id} className="flex gap-2">
          <input className="input flex-1" value={o.text} aria-label={title} onChange={(e) => onChange(items.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)))} />
          <button aria-label="Remove" onClick={() => onChange(items.filter((x) => x.id !== o.id))} className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-500">
            <Icon name="ph ph-x" className="text-[14px]" />
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...items, { id: uid(), text: '' }])} className="self-start text-[12.5px] text-accent-300">
        + {add}
      </button>
    </div>
  );
}
