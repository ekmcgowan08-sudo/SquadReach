'use client';
/* PLANNER · ROADMAP — seven ministry years by lane. Items drag between
   years and lanes (or Alt+arrow from the keyboard); every change is one
   undo step. Checks and Suggestions read the plan and say why in plain
   words; Publish shows exactly what the app will start or stop showing. */
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ItemPanel, KINDS } from '@/components/planner/item-panel';
import { DismissBox, HEALTH, PageHead, Panel, UndoButtons, usePlanSave } from '@/components/planner/kit';
import { Btn, Icon, cx } from '@/components/ui';
import { advent1, easter } from '@/lib/liturgical';
import type { AiSuggestion } from '@/lib/plan-ai';
import { planChecks, publishDiff, signature, suggestions, type Health } from '@/lib/plan-insights';
import { MONTHS_FROM_AUG, laneColor, monthIndex, nightsOf, teachingOf, yearLabel, yearOf, type PlanItem } from '@/lib/plan';
import { isoDay, nowMs } from '@/lib/dates';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';

type View = 'board' | 'checks' | 'suggestions';

export function Roadmap() {
  const p = useApp((s) => s.data.plan);
  const params = useSearchParams();
  const router = useRouter();
  const view = (params.get('view') as View) || 'board';
  const [open, setOpen] = useState<string | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(params.get('publish') === '1');
  const diff = publishDiff(p);
  const go = (v: View) => router.replace('/planner/roadmap' + (v === 'board' ? '' : '?view=' + v));
  const show = (y: number) => {
    go('board');
    setFlash(y);
    window.setTimeout(() => setFlash(null), 1800);
  };
  const today = isoDay(new Date());
  const checks = planChecks(p, p.settings.startYear + yearOf(p, today), monthIndex(today));
  const open_ = checks.filter((c) => c.status !== 'healthy' && !p.dismissed.some((d) => d.id === 'chk:' + c.id)).length;
  const sugg = suggestions(p);

  return (
    <>
      <PageHead
        kicker={p.settings.name}
        title="Roadmap"
        sub={yearLabel(p.settings.startYear, 0) + ' – ' + yearLabel(p.settings.startYear, 6) + ' · entry at ' + p.settings.entryGrade + 'th grade · ' + p.items.length + ' items'}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-full border border-neutral-800 p-1">
              {(
                [
                  ['board', 'Board'],
                  ['checks', 'Checks' + (open_ ? ' · ' + open_ : '')],
                  ['suggestions', 'Suggestions' + (sugg.length ? ' · ' + sugg.length : '')]
                ] as const
              ).map(([id, label]) => (
                <button key={id} onClick={() => go(id)} aria-pressed={view === id} className="min-h-8 rounded-full px-3 text-[12px] font-medium" style={{ background: view === id ? 'var(--color-neutral-800)' : 'transparent', color: view === id ? 'var(--color-neutral-100)' : 'var(--color-neutral-400)' }}>
                  {label}
                </button>
              ))}
            </div>
            <UndoButtons />
            <Btn variant="ghost" className="px-3 text-[12px]" href="/planner/one-pager">
              <Icon name="ph ph-printer" className="mr-[6px] text-[14px]" />
              One-pager
            </Btn>
            <Btn className="px-4 text-[12px]" onClick={() => setPublishing(true)}>
              Publish{diff.dirty ? ' · ' + (diff.added.length + diff.changed.length + diff.removed.length) : ''}
            </Btn>
          </div>
        }
      />
      {view === 'board' ? <Board onOpen={setOpen} flash={flash} /> : view === 'checks' ? <Checks onOpen={setOpen} onShow={show} /> : <Suggestions onShow={show} />}
      {open ? <ItemPanel id={open} onClose={() => setOpen(null)} onShow={show} /> : null}
      {publishing ? <PublishPanel onClose={() => setPublishing(false)} /> : null}
    </>
  );
}

function Board({ onOpen, flash }: { onOpen: (id: string) => void; flash: number | null }) {
  const p = useApp((s) => s.data.plan);
  const save = usePlanSave();
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [hideDrafts, setHideDrafts] = useState(false);
  const lanes = p.lanes.filter((l) => l.on);
  const sy = p.settings.startYear;
  const years = [0, 1, 2, 3, 4, 5, 6];
  const move = (id: string, lane: string, year: number) => {
    const it = p.items.find((i) => i.id === id);
    if (!it || (it.lane === lane && it.year === year)) return;
    save((x) => void (x.items = x.items.map((i) => (i.id === id ? { ...i, lane, year } : i))), 'Move ' + it.title + ' to ' + (lanes.find((l) => l.id === lane)?.short ?? lane) + ', ' + yearLabel(sy, year));
  };
  const add = (lane: string, year: number) => {
    const id = uid();
    save((x) => void x.items.push({ id, lane, year, title: 'New ' + (lane === 'teach' ? 'series' : 'item'), kind: lane === 'teach' ? 'series' : lane === 'goals' ? 'goal' : 'event', size: lane === 'teach' ? 6 : 1, status: 'draft', notes: '', tags: [] }), 'Add an item to ' + yearLabel(sy, year));
    onOpen(id);
  };
  const onKey = (e: React.KeyboardEvent, it: PlanItem) => {
    if (!e.altKey) return;
    const li = lanes.findIndex((l) => l.id === it.lane);
    const d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
    if (!d) return;
    e.preventDefault();
    const lane = lanes[Math.max(0, Math.min(lanes.length - 1, li + d[0]))]?.id ?? it.lane;
    const year = Math.max(0, Math.min(6, it.year + d[1]));
    move(it.id, lane, year);
  };

  return (
    <div className="flex flex-col gap-3">
      {!p.items.length ? (
        <div className="sr-card flex flex-wrap items-center gap-4 px-5 py-4">
          <div className="min-w-[260px] flex-1">
            <div className="text-[14px] font-medium text-neutral-100">Seven years, nothing in them yet</div>
            <div className="mt-1 text-[12.5px] leading-[1.5] text-neutral-400 text-pretty">Six short steps set the range, your groups, the night you meet and the breaks you take. Then add to any cell below, or start from suggestions drawn from the gaps.</div>
          </div>
          <Btn className="px-4 text-[12px]" href="/planner/setup">
            Set up the plan
          </Btn>
          <Btn variant="ghost" className="px-4 text-[12px]" href="/planner/roadmap?view=suggestions">
            See suggestions
          </Btn>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-4 text-[11.5px] text-neutral-500">
        <span>Drag an item to another year or lane, or focus it and press Alt + arrows.</span>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={hideDrafts} onChange={(e) => setHideDrafts(e.target.checked)} />
          Hide drafts
        </label>
      </div>
      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <div className="grid min-w-[1180px]" style={{ gridTemplateColumns: '180px repeat(7, minmax(140px, 1fr))' }}>
          <div className="sticky left-0 z-10 border-b border-neutral-800 bg-surface px-3 py-2 text-[11px] text-neutral-500">Lane</div>
          {years.map((y) => {
            const nights = nightsOf(p, y).length;
            const w = teachingOf(p, y).reduce((n, s) => n + s.size, 0);
            return (
              <div key={y} className={cx('border-b border-l border-neutral-800 px-3 py-2 transition-colors', flash === y && 'bg-[color-mix(in_srgb,var(--color-accent)_18%,transparent)]')}>
                <div className="text-[13px] font-medium text-neutral-100">{yearLabel(sy, y)}</div>
                <div className="text-[10.5px] text-neutral-500">
                  Year {y + 1} · {w}/{nights} nights taught
                </div>
              </div>
            );
          })}
          {p.settings.liturgical ? (
            <>
              <div className="sticky left-0 z-10 border-b border-neutral-800 bg-surface px-3 py-2 text-[12px] text-neutral-400">Church year</div>
              {years.map((y) => (
                <div key={y} className="border-b border-l border-neutral-800 px-3 py-2 text-[10.5px] leading-[1.5] text-neutral-500">
                  Advent {fmtShort(advent1(sy + y))} · Easter {fmtShort(easter(sy + y + 1))}
                </div>
              ))}
            </>
          ) : null}
          {lanes.map((l) => (
            <Lane key={l.id} lane={l}>
              {years.map((y) => {
                const cell = l.id + '|' + y;
                const items = p.items.filter((i) => i.lane === l.id && i.year === y && !(hideDrafts && i.status === 'draft'));
                return (
                  <div
                    key={y}
                    onDragOver={(e) => {
                      if (!drag) return;
                      e.preventDefault();
                      setOver(cell);
                    }}
                    onDragLeave={() => setOver((o) => (o === cell ? null : o))}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (drag) move(drag, l.id, y);
                      setDrag(null);
                      setOver(null);
                    }}
                    className={cx('group relative flex min-h-[64px] flex-col gap-1 border-b border-l border-neutral-800 p-[6px]', drag && 'outline outline-1 -outline-offset-2 outline-neutral-800', over === cell && 'bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] outline-accent-500', flash === y && 'bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]')}
                  >
                    {items.map((it) => (
                      <button
                        key={it.id}
                        draggable
                        onDragStart={(e) => {
                          setDrag(it.id);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', it.id);
                        }}
                        onDragEnd={() => {
                          setDrag(null);
                          setOver(null);
                        }}
                        onClick={() => onOpen(it.id)}
                        onKeyDown={(e) => onKey(e, it)}
                        className={cx('flex items-start gap-[6px] rounded-md px-2 py-[5px] text-left text-[11.5px] leading-[1.3]', it.status === 'draft' && 'italic')}
                        style={{
                          background: it.status === 'confirmed' ? 'color-mix(in srgb, ' + laneColor(l.hue) + ' 22%, var(--color-neutral-900))' : 'transparent',
                          border: '1px ' + (it.status === 'draft' ? 'dashed' : 'solid') + ' ' + laneColor(l.hue),
                          color: 'var(--color-neutral-100)',
                          opacity: drag === it.id ? 0.4 : 1
                        }}
                        title={it.title + ' — ' + KINDS[it.kind].label + ' · ' + it.size + ' ' + KINDS[it.kind].size.toLowerCase() + (it.month !== undefined ? ' · from ' + MONTHS_FROM_AUG[it.month] : '')}
                      >
                        <Icon name={'ph ' + KINDS[it.kind].icon} className="mt-[1px] flex-none text-[11px] text-neutral-400" />
                        {/* One line each, cut short rather than wrapped (the full title is on hover and read aloud). */}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{it.title}</span>
                          {it.kind === 'series' || it.suggested ? (
                            <span className="block truncate text-[10.5px] not-italic text-neutral-300">
                              {it.kind === 'series' ? it.size + ' weeks' : null}
                              {it.kind === 'series' && it.suggested ? ' · ' : null}
                              {it.suggested ? <span className="text-accent-300">suggested</span> : null}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    ))}
                    <button onClick={() => add(l.id, y)} aria-label={'Add to ' + l.short + ' in ' + yearLabel(sy, y)} className="mt-auto self-start rounded px-1 text-[11px] text-neutral-600 opacity-0 group-hover:opacity-100 focus:opacity-100">
                      + Add
                    </button>
                  </div>
                );
              })}
            </Lane>
          ))}
        </div>
      </div>
    </div>
  );
}

const fmtShort = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function Lane({ lane, children }: { lane: { id: string; name: string; hue: number }; children: React.ReactNode }) {
  return (
    <>
      <div className="sticky left-0 z-10 flex items-start gap-2 border-b border-neutral-800 bg-surface px-3 py-2">
        <span className="mt-[5px] h-2 w-2 flex-none rounded-full" style={{ background: laneColor(lane.hue) }} />
        <span className="text-[12px] leading-[1.3] text-neutral-300">{lane.name}</span>
      </div>
      {children}
    </>
  );
}


function Checks({ onOpen, onShow }: { onOpen: (id: string) => void; onShow: (y: number) => void }) {
  const p = useApp((s) => s.data.plan);
  const save = usePlanSave();
  const today = isoDay(new Date());
  const list = planChecks(p, p.settings.startYear + yearOf(p, today), monthIndex(today));
  const dismissed = (id: string) => p.dismissed.find((d) => d.id === 'chk:' + id);
  const order: Health[] = ['gap', 'attention', 'healthy'];
  const sorted = [...list].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {sorted.map((c) => {
        const dis = c.status !== 'healthy' ? dismissed(c.id) : undefined;
        const h = HEALTH[dis ? 'dismissed' : c.status];
        return (
          <div key={c.id} className="sr-card flex flex-col gap-2 px-4 py-3" style={{ boxShadow: 'inset 3px 0 0 ' + h.color }}>
            <div className="flex items-center gap-2">
              <span className="flex-1 text-[13.5px] font-medium text-neutral-100">{c.title}</span>
              <span className="rounded-full px-2 py-[3px] text-[10.5px] font-semibold" style={{ color: h.color, border: '1px solid ' + h.color }}>
                {h.label}
              </span>
            </div>
            <div className="text-[12.5px] leading-[1.55] text-neutral-300 text-pretty">{c.reason}</div>
            {dis ? (
              <div className="flex items-center gap-2 text-[11.5px] text-neutral-500">
                <span className="flex-1">
                  Set aside by {dis.by}: “{dis.reason}”
                </span>
                <button onClick={() => save((x) => void (x.dismissed = x.dismissed.filter((d) => d.id !== 'chk:' + c.id)), 'Restore a check')} className="text-accent-300">
                  Restore
                </button>
              </div>
            ) : c.status !== 'healthy' ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {c.fix ? (
                    <Btn variant="secondary" className="px-3 text-[12px]" onClick={() => save((x) => c.fix!.apply(x, uid), c.fix!.label)}>
                      {c.fix.label}
                    </Btn>
                  ) : null}
                  {c.item ? (
                    <Btn variant="ghost" className="px-3 text-[12px]" onClick={() => onOpen(c.item!)}>
                      Open it
                    </Btn>
                  ) : null}
                  {c.year !== undefined ? (
                    <Btn variant="ghost" className="px-3 text-[12px]" onClick={() => onShow(c.year!)}>
                      Show on board
                    </Btn>
                  ) : null}
                </div>
                <DismissBox id={'chk:' + c.id} />
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Suggestions({ onShow }: { onShow: (y: number) => void }) {
  const p = useApp((s) => s.data.plan);
  const save = usePlanSave();
  const list = suggestions(p);
  const set = p.dismissed.filter((d) => d.id.startsWith('sug:'));
  const sy = p.settings.startYear;
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1.6fr_1fr]">
      <div className="flex flex-col gap-3">
        <div className="text-[12px] leading-[1.5] text-neutral-500">Read from the plan itself, never stored. Adding one makes a dashed draft marked as suggested; confirming it stays a leader’s tap. Passages are references only — nothing is quoted or invented.</div>
        {!list.length ? <div className="sr-card px-4 py-6 text-center text-[12.5px] text-neutral-500">No suggestions right now.</div> : null}
        {list.map((s) => (
          <div key={s.id} className="sr-card flex flex-col gap-2 px-4 py-3">
            <div className="flex items-baseline gap-2">
              <span className="flex-1 text-[14px] font-medium text-neutral-100">{s.title}</span>
              <span className="text-[11px] text-neutral-500">
                {yearLabel(sy, s.year)} · {p.lanes.find((l) => l.id === s.lane)?.short} · {s.kind === 'series' ? s.size + ' weeks' : KINDS[s.kind].label}
              </span>
            </div>
            <div className="text-[12.5px] leading-[1.55] text-neutral-300 text-pretty">{s.reason}</div>
            <div className="text-[11px] text-neutral-500">
              Rule: {s.rule === 'teaching-gap' ? 'teaching gap in the next three years' : 'a yearly rhythm with no next-year entry'}
              {s.cites.length ? ' · Passages: ' + s.cites.join('; ') : ''}
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn
                variant="secondary"
                className="px-3 text-[12px]"
                onClick={() => save((x) => void x.items.push({ id: uid(), lane: s.lane, year: s.year, title: s.title, kind: s.kind, size: s.size, status: 'draft', notes: '', tags: s.tags, month: s.month, refs: s.cites.join('; ') || undefined, suggested: { reason: s.reason, rule: s.rule, cites: s.cites } }), 'Add suggested ' + s.title)}
              >
                Add as a draft
              </Btn>
              <Btn variant="ghost" className="px-3 text-[12px]" onClick={() => onShow(s.year)}>
                Show on board
              </Btn>
            </div>
            <DismissBox id={s.id} />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-5">
        <ClaudeIdeas onShow={onShow} />
        <Panel title="Set aside" meta={set.length ? set.length + '' : ''}>
          {!set.length ? <div className="text-[12px] text-neutral-500">Nothing set aside.</div> : null}
        {set.map((d) => (
          <div key={d.id} className="flex items-start gap-2 border-t border-divider pt-2 text-[12px] first:border-t-0 first:pt-0">
            <div className="min-w-0 flex-1">
              <div className="text-neutral-200">{d.id.replace(/^sug:\w+\|/, '')}</div>
              <div className="text-[11px] text-neutral-500">
                “{d.reason}” · {d.by}
              </div>
            </div>
            <button onClick={() => save((x) => void (x.dismissed = x.dismissed.filter((y) => y.id !== d.id)), 'Restore a suggestion')} className="text-[12px] text-accent-300">
              Restore
            </button>
          </div>
        ))}
        </Panel>
      </div>
    </div>
  );
}

/* Ideas from Claude, on request: checked on the server (lib/plan-ai), shown
   here, never stored until a leader adds one as a dashed draft. */
function ClaudeIdeas({ onShow }: { onShow: (y: number) => void }) {
  const p = useApp((s) => s.data.plan);
  const mode = useApp((s) => s.membership.mode);
  const save = usePlanSave();
  const [state, setState] = useState<{ busy: boolean; error: string | null; ideas: AiSuggestion[] | null; dropped: number }>({ busy: false, error: null, ideas: null, dropped: 0 });
  const sy = p.settings.startYear;
  const ask = async () => {
    setState((x) => ({ ...x, busy: true, error: null }));
    try {
      const r = await fetch('/api/planner/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mode === 'demo' ? { plan: p } : {}) });
      const out = (await r.json().catch(() => ({}))) as { ideas?: AiSuggestion[]; dropped?: number; error?: string };
      if (!r.ok || !out.ideas) setState({ busy: false, error: out.error ?? 'Something went wrong (' + r.status + ').', ideas: null, dropped: 0 });
      else setState({ busy: false, error: null, ideas: out.ideas, dropped: out.dropped ?? 0 });
    } catch {
      setState({ busy: false, error: 'Couldn’t reach the server.', ideas: null, dropped: 0 });
    }
  };
  const ideas = (state.ideas ?? []).filter((s) => !p.dismissed.some((d) => d.id === s.id) && !p.items.some((i) => i.title.trim().toLowerCase() === s.title.toLowerCase()));
  return (
    <Panel title="Ideas from Claude" meta={state.ideas ? ideas.length + ' to review' : ''}>
      <div className="text-[12px] leading-[1.5] text-neutral-500 text-pretty">Claude reads this plan — your tradition, translation, each year’s teaching and the coverage gaps — and suggests series to fill them. Passages are references only; nothing is added until you tap it.</div>
      <Btn variant="secondary" className="self-start px-3 text-[12px]" disabled={state.busy} onClick={() => void ask()}>
        <Icon name={state.busy ? 'ph ph-circle-notch animate-spin' : 'ph ph-sparkle'} className="mr-[6px] text-[13px]" />
        {state.busy ? 'Reading the plan…' : state.ideas ? 'Ask again' : 'Ask Claude for ideas'}
      </Btn>
      {state.error ? <div className="text-[12px] leading-[1.5] text-[oklch(0.8_0.09_24)]">{state.error}</div> : null}
      {state.ideas && !ideas.length ? <div className="text-[12px] text-neutral-500">Nothing new to suggest this time.</div> : null}
      {state.dropped ? <div className="text-[11px] text-neutral-500">{state.dropped} more {state.dropped === 1 ? 'idea was' : 'ideas were'} left out for not citing real passages, quoting text, or repeating the plan.</div> : null}
      {ideas.map((s) => (
        <div key={s.id} className="flex flex-col gap-2 rounded-md border border-dashed border-accent-700 px-3 py-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-[.1em] text-accent-300">Suggested by Claude · review before adding</div>
          <div className="flex items-baseline gap-2">
            <span className="flex-1 text-[13.5px] font-medium text-neutral-100">{s.title}</span>
            <span className="text-[11px] text-neutral-500">
              {yearLabel(sy, s.year)} · {s.size} weeks{s.month !== undefined ? ' · from ' + MONTHS_FROM_AUG[s.month] : ''}
            </span>
          </div>
          <div className="text-[12.5px] leading-[1.5] text-neutral-200">{s.bigIdea}</div>
          <div className="text-[12px] leading-[1.5] text-neutral-400 text-pretty">{s.reason}</div>
          <div className="text-[11px] text-neutral-500">Passages: {s.cites.join('; ')}</div>
          <div className="flex flex-wrap gap-2">
            <Btn
              variant="secondary"
              className="px-3 text-[12px]"
              onClick={() => save((x) => void x.items.push({ id: uid(), lane: 'teach', year: s.year, title: s.title, kind: 'series', size: s.size, status: 'draft', notes: '', tags: s.tags, month: s.month, refs: s.cites.join('; '), bigIdea: s.bigIdea, suggested: { reason: s.reason, rule: 'claude', cites: s.cites } }), 'Add Claude’s idea: ' + s.title)}
            >
              Add as a draft
            </Btn>
            <Btn variant="ghost" className="px-3 text-[12px]" onClick={() => onShow(s.year)}>
              Show on board
            </Btn>
          </div>
          <DismissBox id={s.id} />
        </div>
      ))}
    </Panel>
  );
}

function Section({ title, items }: { title: string; items: { id: string; title: string }[] }) {
  return items.length ? (
    <div>
      <div className="sr-label mb-1">
        {title} · {items.length}
      </div>
      {items.map((i) => (
        <div key={i.id} className="text-[12.5px] text-neutral-200">
          {i.title}
        </div>
      ))}
    </div>
  ) : null;
}

function PublishPanel({ onClose }: { onClose: () => void }) {
  const p = useApp((s) => s.data.plan);
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const save = usePlanSave();
  const diff = publishDiff(p);
  const sy = p.settings.startYear;
  const publish = () => {
    save((x) => void (x.published = { at: nowMs(), by: m.displayName, items: Object.fromEntries(publishDiff(x).live.map((i) => [i.id, signature(i)])) }), 'Publish the plan');
    api().logActivity('Published the ' + yearLabel(sy, 0) + ' plan · ' + diff.added.length + ' new, ' + diff.changed.length + ' changed, ' + diff.removed.length + ' taken down');
    api().say('Published. Leaders and families see year one’s confirmed plan.');
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="w-full max-w-[520px] rounded-lg border border-neutral-800 bg-surface p-5 shadow-lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Publish the plan">
        <div className="text-[18px] font-medium text-neutral-100">Publish {yearLabel(sy, 0)}</div>
        <div className="mt-1 text-[12.5px] leading-[1.5] text-neutral-400 text-pretty">
          The app shows year one’s confirmed items to leaders and families. This is exactly what changes{p.published ? ' since ' + new Date(p.published.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' (' + p.published.by + ')' : ' — it has never been published'}.
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <Section title="New" items={diff.added} />
          <Section title="Changed" items={diff.changed} />
          <Section title="Taken down" items={diff.removed} />
          {!diff.dirty ? <div className="text-[12.5px] text-neutral-500">Nothing has changed since the last publish.</div> : null}
          <div className="text-[11.5px] text-neutral-500">
            Held back, never sent: {diff.heldDrafts} drafts and {diff.heldLater} confirmed items in later years.
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <Btn className="px-4" disabled={!diff.dirty} onClick={publish}>
            Publish
          </Btn>
          <Btn variant="ghost" className="px-3" onClick={onClose}>
            Not yet
          </Btn>
        </div>
      </div>
    </div>
  );
}
