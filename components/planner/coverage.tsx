'use client';
/* PLANNER · COVERAGE — what each graduating class will have received, by
   category, read from the tags on the teaching it actually sits under.
   Three statuses, each with its reason in plain words; no score, ever.
   A cell can be set aside with a recorded reason ("covered at camp"). */
import { useState } from 'react';
import { DismissBox, HEALTH, PageHead, Panel, usePlanSave } from '@/components/planner/kit';
import { Icon, cx } from '@/components/ui';
import { isoDay } from '@/lib/dates';
import { COVERAGE_CATS, COVERAGE_GROUPS, assessCoverage, cohortYears, cohorts, type CoverageCell } from '@/lib/plan-insights';
import { laneColor, teachingOf, yearLabel, yearOf } from '@/lib/plan';
import { useApp } from '@/lib/store/provider';

const STATE = { received: 'Received', current: 'This year', planned: 'Planned' } as const;

export function Coverage() {
  const p = useApp((s) => s.data.plan);
  const save = usePlanSave();
  const today = isoDay(new Date());
  const nowYear = p.settings.startYear + yearOf(p, today);
  const cs = cohorts(p);
  const [issues, setIssues] = useState(false);
  const [sel, setSel] = useState<{ cat: string; c: number } | null>(null);
  const [journey, setJourney] = useState<number>(cs[0]);
  const grid = COVERAGE_CATS.map((cat) => ({ cat, cells: cs.map((c) => assessCoverage(p, cat.id, c, nowYear)) }));
  const tally = { healthy: 0, attention: 0, gap: 0, dismissed: 0 };
  for (const r of grid) for (const c of r.cells) tally[c.dismissed ? 'dismissed' : c.status]++;
  const cell = sel ? assessCoverage(p, sel.cat, sel.c, nowYear) : null;
  const untagged = p.items.filter((i) => i.kind === 'series' && i.lane === 'teach' && !i.tags.length);

  return (
    <>
      <PageHead
        kicker={p.settings.name}
        title="Coverage"
        sub="What each graduating class will have received by the time they leave, read from the tags on the teaching it sits under. Three statuses, each with its reason — never a score."
        right={
          <label className="flex items-center gap-2 text-[12px] text-neutral-400">
            <input type="checkbox" checked={issues} onChange={(e) => setIssues(e.target.checked)} />
            Only rows that need a look
          </label>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {(['gap', 'attention', 'healthy', 'dismissed'] as const).map((k) => (
          <span key={k} className="flex items-center gap-2 rounded-full border border-neutral-800 px-3 py-[5px] text-[12px] text-neutral-300">
            <span className="h-[10px] w-[10px] rounded-sm" style={{ background: HEALTH[k].color }} />
            {HEALTH[k].label} · {tally[k]}
          </span>
        ))}
        {untagged.length ? (
          <span className="flex items-center gap-2 rounded-full border border-dashed border-neutral-700 px-3 py-[5px] text-[12px] text-neutral-400">
            <Icon name="ph ph-tag" className="text-[12px]" />
            {untagged.length} series carry no tags, so they count toward nothing
          </span>
        ) : null}
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_380px]">
        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-surface px-3 py-2 text-[11px] font-normal text-neutral-500">Category</th>
                {cs.map((c) => {
                  const ys = cohortYears(p, c).filter((y) => y.inPlan).length;
                  return (
                    <th key={c} className="border-l border-neutral-800 px-2 py-2 text-center">
                      <button onClick={() => setJourney(c)} className={cx('rounded px-1 text-[12px] font-medium', journey === c ? 'text-accent-200' : 'text-neutral-100')}>
                        Class of {c}
                      </button>
                      <div className="text-[10px] font-normal text-neutral-500">{ys} years here</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {COVERAGE_GROUPS.map((g) => {
                const rows = grid.filter((r) => r.cat.group === g.id && (!issues || r.cells.some((c) => c.status !== 'healthy' && !c.dismissed)));
                if (!rows.length) return null;
                return [
                  <tr key={g.id}>
                    <td colSpan={cs.length + 1} className="border-t border-neutral-800 bg-neutral-900/40 px-3 py-[7px]">
                      <span className="text-[11.5px] font-semibold uppercase tracking-[.1em]" style={{ color: laneColor(g.hue) }}>
                        {g.name}
                      </span>
                      <span className="ml-2 text-[11px] text-neutral-500">
                        {g.note} · target {g.target} across a full stay
                      </span>
                    </td>
                  </tr>,
                  ...rows.map((r) => (
                    <tr key={r.cat.id} className="border-t border-neutral-800">
                      <td className="sticky left-0 z-10 bg-surface px-3 py-[6px] text-[12.5px] text-neutral-200">{r.cat.name}</td>
                      {r.cells.map((c) => (
                        <td key={c.cohort} className="border-l border-neutral-800 p-[3px]">
                          <CellButton c={c} on={sel?.cat === c.cat.id && sel.c === c.cohort} onClick={() => setSel({ cat: c.cat.id, c: c.cohort })} />
                        </td>
                      ))}
                    </tr>
                  ))
                ];
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-4 xl:sticky xl:top-[76px]">
          {cell ? (
            <Panel
              title={cell.cat.name + ' · Class of ' + cell.cohort}
              right={
                <button aria-label="Close" onClick={() => setSel(null)} className="text-neutral-500">
                  <Icon name="ph ph-x" className="text-[14px]" />
                </button>
              }
            >
              <div className="flex items-center gap-2">
                <span className="rounded-full px-2 py-[3px] text-[10.5px] font-semibold" style={{ color: HEALTH[cell.dismissed ? 'dismissed' : cell.status].color, border: '1px solid ' + HEALTH[cell.dismissed ? 'dismissed' : cell.status].color }}>
                  {HEALTH[cell.dismissed ? 'dismissed' : cell.status].label}
                </span>
                <span className="text-[11.5px] text-neutral-500">
                  {cell.total} of {cell.target} · {cell.inPlan} years in this plan
                </span>
              </div>
              <div className="text-[12.5px] leading-[1.55] text-neutral-300 text-pretty">{cell.reason}</div>
              {cell.entries.length ? (
                <div className="flex flex-col gap-1">
                  {cell.entries.map((e, i) => (
                    <div key={i} className="flex items-baseline gap-2 text-[12px]">
                      <span className="w-[64px] flex-none text-neutral-500">{yearLabel(e.year, 0)}</span>
                      <span className="w-[38px] flex-none text-neutral-500">{e.grade}th</span>
                      <span className="min-w-0 flex-1 text-neutral-200">{e.title}</span>
                      <span className="text-[10.5px] text-neutral-500">{STATE[e.state]}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {cell.dismissed ? (
                <div className="flex items-center gap-2 text-[11.5px] text-neutral-500">
                  <span className="flex-1">
                    Set aside by {cell.dismissed.by}: “{cell.dismissed.reason}”
                  </span>
                  <button onClick={() => save((x) => void (x.dismissed = x.dismissed.filter((d) => d.id !== cell.key)), 'Restore a coverage cell')} className="text-accent-300">
                    Restore
                  </button>
                </div>
              ) : cell.status !== 'healthy' ? (
                <>
                  <div className="text-[11.5px] leading-[1.5] text-neutral-500">To fix it, tag a series this class sits under with “{cell.cat.name}” on the Roadmap, or plan one. If it’s covered somewhere the plan can’t see, set it aside and say where.</div>
                  <DismissBox id={cell.key} />
                </>
              ) : null}
            </Panel>
          ) : (
            <Panel title="Read a cell">
              <div className="text-[12.5px] leading-[1.55] text-neutral-400">Pick any square to see why it reads the way it does, what that class receives and when, and to set it aside with a reason if it’s covered somewhere the plan can’t see.</div>
            </Panel>
          )}
          <Journey c={journey} nowYear={nowYear} onPick={setJourney} />
        </div>
      </div>
    </>
  );
}

function CellButton({ c, on, onClick }: { c: CoverageCell; on: boolean; onClick: () => void }) {
  const h = HEALTH[c.dismissed ? 'dismissed' : c.status];
  return (
    <button onClick={onClick} aria-pressed={on} aria-label={c.cat.name + ', class of ' + c.cohort + ': ' + h.label} title={c.reason} className={cx('flex h-[30px] w-full items-center justify-center rounded text-[11px] font-medium', on && 'ring-2 ring-accent-400')} style={{ background: 'color-mix(in srgb, ' + h.color + (c.status === 'healthy' && !c.dismissed ? ' 26%' : ' 40%') + ', transparent)', color: 'var(--color-neutral-100)' }}>
      {c.total}/{c.target}
    </button>
  );
}

/* One class from entry to graduation: which years fall in the plan and
   what's taught each of them. */
function Journey({ c, nowYear, onPick }: { c: number; nowYear: number; onPick: (c: number) => void }) {
  const p = useApp((s) => s.data.plan);
  const cs = cohorts(p);
  const sy = p.settings.startYear;
  return (
    <Panel
      title="Cohort journey"
      right={
        <select className="bg-transparent text-[12px] text-neutral-200 outline-none" value={c} onChange={(e) => onPick(Number(e.target.value))} aria-label="Class">
          {cs.map((x) => (
            <option key={x} value={x}>
              Class of {x}
            </option>
          ))}
        </select>
      }
    >
      <div className="flex flex-col">
        {cohortYears(p, c).map((y) => {
          const series = y.inPlan ? teachingOf(p, y.year - sy) : [];
          return (
            <div key={y.grade} className="flex gap-3 border-t border-divider py-2 first:border-t-0">
              <div className="w-[56px] flex-none">
                <div className="text-[12.5px] font-medium text-neutral-100">{y.grade}th</div>
                <div className="text-[10.5px] text-neutral-500">{yearLabel(y.year, 0)}</div>
              </div>
              <div className="min-w-0 flex-1 text-[12px] leading-[1.5]">
                {!y.inPlan ? (
                  <span className="text-neutral-600">{y.year < sy ? 'Before this plan' : 'After this plan'}</span>
                ) : series.length ? (
                  series.map((s) => (
                    <div key={s.id} className={cx('text-neutral-300', s.status === 'draft' && 'italic text-neutral-400')}>
                      {s.title}
                      {s.tags.length ? <span className="text-neutral-500"> · {s.tags.map((t) => COVERAGE_CATS.find((x) => x.id === t)?.name ?? t).join(', ')}</span> : null}
                    </div>
                  ))
                ) : (
                  <span className="text-neutral-500">No teaching planned yet</span>
                )}
              </div>
              <div className="w-[60px] flex-none text-right text-[10.5px] text-neutral-500">{!y.inPlan ? '' : y.year < nowYear ? 'Received' : y.year === nowYear ? 'This year' : 'Planned'}</div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
