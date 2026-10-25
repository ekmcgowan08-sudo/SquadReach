'use client';
/* One plan item, in a drawer on the right: what it is, where it sits, what
   it teaches, what happened last time, and the earlier runs of the same
   thing so next year's copy starts from what was learned. */
import { useEffect } from 'react';
import { usePlanSave } from '@/components/planner/kit';
import { Btn, Icon } from '@/components/ui';
import { COVERAGE_CATS, COVERAGE_GROUPS, norm } from '@/lib/plan-insights';
import { MONTHS_FROM_AUG, laneColor, yearLabel, type ItemKind, type PlanItem } from '@/lib/plan';
import { uid } from '@/lib/store/app-store';
import { useApp } from '@/lib/store/provider';

const RULES: Record<string, string> = { 'teaching-gap': 'a teaching gap', 'yearly-rhythm': 'a yearly rhythm', claude: 'by Claude' };

export const KINDS: Record<ItemKind, { label: string; size: string; ref: string; icon: string }> = {
  series: { label: 'Teaching series', size: 'Weeks', ref: 'Rescheduling moves the series, not its lessons — content, assignments, attendance and debriefs stay put.', icon: 'ph-book-open-text' },
  event: { label: 'Event', size: 'Days', ref: 'Where an event sits in the plan. Registration and RSVPs live on the calendar event.', icon: 'ph-calendar-star' },
  trip: { label: 'Trip or camp', size: 'Days', ref: 'Permissions, rosters and payments stay on the event and its slips. The plan shows where it sits.', icon: 'ph-tent' },
  milestone: { label: 'Milestone', size: 'Weeks out', ref: 'A date the plan is measured against. It carries no content.', icon: 'ph-flag' },
  recurring: { label: 'Recurring rhythm', size: 'Times a year', ref: 'One rule, not twelve copies. Editing it edits every occurrence.', icon: 'ph-repeat' },
  goal: { label: 'Goal', size: 'Weeks out', ref: 'Measured, never scored. A goal with nothing supporting it in the lanes it names is flagged.', icon: 'ph-target' }
};

export function ItemPanel({ id, onClose, onShow }: { id: string; onClose: () => void; onShow?: (y: number) => void }) {
  const p = useApp((s) => s.data.plan);
  const save = usePlanSave();
  const it = p.items.find((x) => x.id === id);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return void t.blur();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!it) return null;
  const sy = p.settings.startYear;
  const set = (patch: Partial<PlanItem>, label: string, merge?: string) => save((x) => void (x.items = x.items.map((i) => (i.id === id ? { ...i, ...patch } : i))), label, merge ? { merge } : undefined);
  const earlier = p.items.filter((x) => x.id !== id && norm(x.title) === norm(it.title) && x.year < it.year).sort((a, b) => b.year - a.year);
  const runs = [...earlier.filter((x) => x.debrief), ...(it.debrief ? [it] : [])];
  const freeYear = [1, 2, 3, 4, 5, 6].map((d) => it.year + d).find((y) => y <= 6 && !p.items.some((x) => x.year === y && norm(x.title) === norm(it.title)));
  const lane = p.lanes.find((l) => l.id === it.lane);
  const k = KINDS[it.kind];

  return (
    <aside className="fixed bottom-0 right-0 top-[57px] z-[60] flex w-full max-w-[440px] flex-col border-l border-neutral-800 bg-surface shadow-lg" role="dialog" aria-label={it.title}>
      <div className="flex items-center gap-2 border-b border-divider px-5 py-3">
        <span className="h-3 w-3 rounded-full" style={{ background: laneColor(lane?.hue ?? 0) }} />
        <span className="flex-1 text-[11.5px] uppercase tracking-[.1em] text-neutral-500">
          {k.label} · {lane?.short ?? it.lane} · {yearLabel(sy, it.year)}
        </span>
        <button aria-label="Close" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400">
          <Icon name="ph ph-x" className="text-[15px]" />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        <input className="input text-[16px] font-medium" value={it.title} onChange={(e) => set({ title: e.target.value }, 'Rename ' + it.title, 'title:' + id)} aria-label="Title" />
        {it.suggested ? (
          <div className="rounded-md border border-dashed border-accent-600 px-3 py-[10px] text-[12px] leading-[1.5] text-neutral-300">
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[.1em] text-accent-300">Suggested · {RULES[it.suggested.rule] ?? it.suggested.rule}</div>
            {it.suggested.reason}
            {it.suggested.cites.length ? <div className="mt-1 text-neutral-500">Passages: {it.suggested.cites.join('; ')}</div> : null}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            <span className="sr-label">Lane</span>
            <select className="input" value={it.lane} onChange={(e) => set({ lane: e.target.value }, 'Move ' + it.title + ' to ' + (p.lanes.find((l) => l.id === e.target.value)?.short ?? ''))}>
              {p.lanes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="sr-label">Year</span>
            <select className="input" value={it.year} onChange={(e) => set({ year: Number(e.target.value) }, 'Move ' + it.title + ' to ' + yearLabel(sy, Number(e.target.value)))}>
              {[0, 1, 2, 3, 4, 5, 6].map((y) => (
                <option key={y} value={y}>
                  {yearLabel(sy, y)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="sr-label">Kind</span>
            <select className="input" value={it.kind} onChange={(e) => set({ kind: e.target.value as ItemKind }, 'Change the kind of ' + it.title)}>
              {(Object.keys(KINDS) as ItemKind[]).map((x) => (
                <option key={x} value={x}>
                  {KINDS[x].label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="sr-label">{k.size}</span>
            <input className="input" type="number" min={1} max={52} value={it.size} onChange={(e) => set({ size: Math.max(1, Math.min(52, Number(e.target.value) || 1)) }, 'Resize ' + it.title, 'size:' + id)} />
          </label>
          <label className="field">
            <span className="sr-label">Starts</span>
            <select className="input" value={it.month ?? ''} onChange={(e) => set({ month: e.target.value === '' ? undefined : Number(e.target.value) }, 'Reschedule ' + it.title)}>
              <option value="">No month set</option>
              {MONTHS_FROM_AUG.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="sr-label">Status</span>
            <select className="input" value={it.status} onChange={(e) => set({ status: e.target.value as PlanItem['status'], ...(e.target.value === 'confirmed' ? { suggested: undefined } : {}) }, (e.target.value === 'confirmed' ? 'Confirm ' : 'Mark as draft: ') + it.title)}>
              <option value="draft">Draft</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </label>
        </div>
        <div className="text-[11.5px] leading-[1.5] text-neutral-500">{k.ref}</div>

        {it.kind === 'series' ? (
          <>
            <label className="field">
              <span className="sr-label">Big idea</span>
              <input className="input" value={it.bigIdea ?? ''} onChange={(e) => set({ bigIdea: e.target.value }, 'Big idea for ' + it.title, 'big:' + id)} placeholder="One sentence the room should leave with" />
            </label>
            <label className="field">
              <span className="sr-label">Passages</span>
              <input className="input" value={it.refs ?? ''} onChange={(e) => set({ refs: e.target.value }, 'Passages for ' + it.title, 'refs:' + id)} placeholder="Ephesians 1–6" />
            </label>
            <div>
              <div className="sr-label mb-2">What it covers</div>
              {COVERAGE_GROUPS.map((g) => (
                <div key={g.id} className="mb-2">
                  <div className="mb-1 text-[11px] text-neutral-500">{g.name}</div>
                  <div className="flex flex-wrap gap-[5px]">
                    {COVERAGE_CATS.filter((c) => c.group === g.id).map((c) => {
                      const on = it.tags.includes(c.id);
                      return (
                        <button key={c.id} onClick={() => set({ tags: on ? it.tags.filter((t) => t !== c.id) : [...it.tags, c.id] }, (on ? 'Untag ' : 'Tag ') + it.title)} aria-pressed={on} className="min-h-8 rounded-full border px-[10px] text-[11.5px]" style={{ borderColor: on ? laneColor(g.hue) : 'var(--color-neutral-800)', color: on ? 'var(--color-neutral-100)' : 'var(--color-neutral-500)', background: on ? 'color-mix(in srgb, ' + laneColor(g.hue) + ' 18%, transparent)' : 'transparent' }}>
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {it.kind === 'goal' ? (
          <div>
            <div className="sr-label mb-2">Supported by</div>
            <div className="flex flex-wrap gap-[5px]">
              {p.lanes
                .filter((l) => l.id !== 'goals')
                .map((l) => {
                  const on = (it.supports ?? []).includes(l.id);
                  return (
                    <button key={l.id} onClick={() => set({ supports: on ? (it.supports ?? []).filter((x) => x !== l.id) : [...(it.supports ?? []), l.id] }, 'Supports for ' + it.title)} aria-pressed={on} className="min-h-8 rounded-full border px-[10px] text-[11.5px]" style={{ borderColor: on ? laneColor(l.hue) : 'var(--color-neutral-800)', color: on ? 'var(--color-neutral-100)' : 'var(--color-neutral-500)' }}>
                      {l.short}
                    </button>
                  );
                })}
            </div>
          </div>
        ) : null}

        <label className="field">
          <span className="sr-label">Notes</span>
          <textarea className="input min-h-[70px] py-2 text-[12.5px]" value={it.notes} onChange={(e) => set({ notes: e.target.value }, 'Notes on ' + it.title, 'notes:' + id)} />
        </label>

        <div className="rounded-md border border-neutral-800 p-3">
          <div className="sr-label mb-2">Debrief</div>
          <div className="grid gap-2">
            <input className="input" placeholder="What worked" value={it.debrief?.worked ?? ''} onChange={(e) => set({ debrief: { worked: e.target.value, change: it.debrief?.change ?? '' } }, 'Debrief for ' + it.title, 'dw:' + id)} aria-label="What worked" />
            <input className="input" placeholder="Change next time" value={it.debrief?.change ?? ''} onChange={(e) => set({ debrief: { worked: it.debrief?.worked ?? '', change: e.target.value } }, 'Debrief for ' + it.title, 'dc:' + id)} aria-label="Change next time" />
          </div>
        </div>

        {runs.length ? (
          <div>
            <div className="sr-label mb-2">Earlier runs</div>
            {runs.map((r) => (
              <div key={r.id} className="mb-2 rounded-md bg-neutral-900 px-3 py-2 text-[12px] leading-[1.5]">
                <div className="text-neutral-400">{yearLabel(sy, r.year)}</div>
                {r.debrief?.worked ? <div className="text-neutral-200">Worked: {r.debrief.worked}</div> : null}
                {r.debrief?.change ? <div className="text-neutral-200">Change: {r.debrief.change}</div> : null}
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-divider pt-3">
          {freeYear !== undefined ? (
            <Btn
              variant="secondary"
              className="px-3 text-[12px]"
              onClick={() => {
                const nid = uid();
                save((x) => void x.items.push({ ...it, id: nid, year: freeYear, status: 'draft', debrief: undefined, suggested: undefined, source: it.id, notes: it.debrief?.change ? 'Last time: ' + it.debrief.change : it.notes }), 'Plan ' + it.title + ' again in ' + yearLabel(sy, freeYear));
                onShow?.(freeYear);
              }}
            >
              Plan again in {yearLabel(sy, freeYear)}
            </Btn>
          ) : null}
          <Btn
            variant="ghost"
            className="px-3 text-[12px] text-neutral-400"
            onClick={() => {
              save((x) => void (x.items = x.items.filter((i) => i.id !== id)), 'Remove ' + it.title);
              onClose();
            }}
          >
            Remove (undoable)
          </Btn>
        </div>
      </div>
    </aside>
  );
}
