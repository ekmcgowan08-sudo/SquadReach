'use client';
/* The huddle sheet: tonight's running order, who serves where, who is on
   the bench, the open posts and the ready check. The phones' Huddle and the
   Home Tonight card read exactly this. */
import { useState } from 'react';
import { Section } from '@/components/console/kit';
import { useHuddleSave } from '@/components/screens/huddle';
import { Btn, Icon } from '@/components/ui';
import { nowMs } from '@/lib/dates';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import { RUN_TEMPLATES, runTemplate } from '@/lib/run-templates';
import { scheduleSentence } from '@/lib/sheet-schedule';
import type { CrewMember, HuddleState, RunSheetItem } from '@/lib/types/model';

const cell = 'input !min-h-9 !py-0';

export function HuddleTab() {
  const h = useApp((s) => s.data.huddle);
  const teams = useApp((s) => s.data.teams);
  const me = useApp((s) => s.membership.displayName);
  const api = useAppApi();
  const save = useHuddleSave();
  /* Any change to the sheet leaves it unpublished; a new owner hasn't been told. */
  const edit = (recipe: (x: HuddleState) => void) =>
    save((x) => {
      recipe(x);
      x.sheetDirty = true;
    });
  const patchItem = (id: string, p: Partial<RunSheetItem>) => edit((x) => void (x.runSheet = x.runSheet.map((it) => (it.id === id ? { ...it, ...p } : it))));
  const patchCrew = (id: string, p: Partial<CrewMember>) => save((x) => void (x.crew = x.crew.map((c) => (c.id === id ? { ...c, ...p } : c))));
  const move = (i: number, dir: -1 | 1) =>
    edit((x) => {
      const j = i + dir;
      if (j < 0 || j >= x.runSheet.length) return;
      [x.runSheet[i], x.runSheet[j]] = [x.runSheet[j], x.runSheet[i]];
    });
  const untold = h.runSheet.filter((it) => it.assignedTo && !it.notifiedAt);
  const unowned = h.runSheet.filter((it) => !it.assignedTo);
  const publish = () => {
    if (!h.sheetDirty && !untold.length && !h.sheetSchedule) return api().say('Nothing has changed since you last published.');
    const at = nowMs();
    const told = untold.map((it) => h.crew.find((c) => c.id === it.assignedTo)?.name).filter(Boolean) as string[];
    save((x) => {
      for (const it of x.runSheet) if (it.assignedTo && !it.notifiedAt) it.notifiedAt = at;
      x.sheetDirty = false;
      x.sheetSchedule = null;
    });
    for (const it of untold) {
      const who = h.crew.find((c) => c.id === it.assignedTo)?.name;
      if (who) api().firePush('You own ' + it.time + ' · ' + it.label, who + ', it’s yours tonight. ' + (it.where ? 'Where: ' + it.where + '.' : ''), '/dashboard/huddle');
    }
    api().logActivity('Published the run sheet — ' + told.length + ' assignment notice' + (told.length === 1 ? '' : 's') + (told.length ? ' (' + told.join(', ') + ')' : '') + ' · ' + me);
    api().say(told.length ? told.length + ' told. Everyone serving sees the new sheet.' : 'Sheet published to everyone serving.');
  };
  const loadTemplate = (id: string) => {
    if (h.runSheet.length && !window.confirm('Replace tonight’s run sheet with this template? Owners are cleared.')) return;
    edit((x) => {
      x.runSheet = runTemplate(id, uid);
      x.runIdx = 0;
      x.runDone = {};
    });
    api().logActivity('Loaded run sheet template: ' + RUN_TEMPLATES.find((t) => t.id === id)?.label);
    api().say('Template loaded — edit it, then publish.');
  };

  return (
    <>
      <Section
        title="Run sheet"
        sub="Tonight in order. Changes show on the phones as you make them; publishing is what tells each new owner what they run. The phone holding the huddle advances it — it never moves on its own."
        right={
          <Btn className="px-3" onClick={() => edit((x) => void x.runSheet.push({ id: uid(), time: '', label: 'New block', where: '', who: '', detail: '', assignedTo: null, notifiedAt: null }))}>
            + Block
          </Btn>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11.5px] text-neutral-500">Start from</span>
          {RUN_TEMPLATES.map((t) => (
            <button key={t.id} title={t.hint} onClick={() => loadTemplate(t.id)} className="min-h-9 rounded-full border border-neutral-700 px-3 text-[12px] text-neutral-300">
              {t.label}
            </button>
          ))}
        </div>
        {h.sheetDirty || untold.length ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-accent-600 px-3 py-[10px]" style={{ background: 'color-mix(in srgb, var(--color-accent) 9%, transparent)' }}>
            <Icon name="ph ph-paper-plane-tilt" className="text-[16px] text-accent-300" />
            <div className="min-w-0 flex-1 text-[12px] leading-[1.45] text-neutral-200">
              Changes since you last published.{untold.length ? ' ' + untold.length + (untold.length === 1 ? ' owner hasn’t' : ' owners haven’t') + ' been told yet.' : ''}
            </div>
            <Btn className="px-4" onClick={publish}>
              {h.sheetSchedule ? 'Publish now instead' : 'Publish'}
            </Btn>
          </div>
        ) : null}
        <SheetScheduler />
        {unowned.length ? (
          <div className="text-[11.5px] leading-[1.5] text-neutral-500 text-pretty">
            {unowned.length} {unowned.length === 1 ? 'item has' : 'items have'} no single owner. Whole-team moments (the huddle, send home) don’t need one; anything that only happens if one person remembers it does.
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          {h.runSheet.map((it, i) => (
            <div key={it.id} className="grid items-center gap-2 rounded-md border border-neutral-800 p-2 sm:grid-cols-[80px_1fr_140px_150px_auto]">
              <input className={cell} defaultValue={it.time} placeholder="6:45pm" aria-label="Time" onBlur={(e) => e.target.value.trim() !== it.time && patchItem(it.id, { time: e.target.value.trim() })} />
              <input className={cell} defaultValue={it.label} aria-label="What" onBlur={(e) => e.target.value.trim() !== it.label && patchItem(it.id, { label: e.target.value.trim() })} />
              <input className={cell} defaultValue={it.where} placeholder="Where" aria-label="Where" onBlur={(e) => e.target.value.trim() !== it.where && patchItem(it.id, { where: e.target.value.trim() })} />
              <div className="flex flex-col gap-1">
                <select
                  className={cell}
                  value={it.assignedTo ?? ''}
                  onChange={(e) => patchItem(it.id, { assignedTo: e.target.value || null, notifiedAt: null, who: h.crew.find((c) => c.id === e.target.value)?.name ?? it.who })}
                  aria-label="Who owns it"
                >
                  <option value="">Everyone serving</option>
                  {h.crew.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {it.assignedTo && !it.notifiedAt ? <span className="text-[10px] font-semibold uppercase tracking-[.08em] text-accent-300">not told yet</span> : null}
              </div>
              <div className="flex gap-1">
                <button aria-label="Move up" onClick={() => move(i, -1)} className="h-9 w-9 rounded-full text-neutral-400">
                  <Icon name="ph ph-arrow-up" className="text-[13px]" />
                </button>
                <button aria-label="Move down" onClick={() => move(i, 1)} className="h-9 w-9 rounded-full text-neutral-400">
                  <Icon name="ph ph-arrow-down" className="text-[13px]" />
                </button>
                <button aria-label="Delete block" onClick={() => edit((x) => void (x.runSheet = x.runSheet.filter((y) => y.id !== it.id)))} className="h-9 w-9 rounded-full text-neutral-500">
                  <Icon name="ph ph-trash" className="text-[13px]" />
                </button>
              </div>
              <input className={cell + ' sm:col-span-5'} defaultValue={it.detail} placeholder="Notes for whoever runs it" aria-label="Notes" onBlur={(e) => e.target.value.trim() !== it.detail && patchItem(it.id, { detail: e.target.value.trim() })} />
            </div>
          ))}
          {!h.runSheet.length ? <div className="text-[12px] text-neutral-500">No blocks yet. Start from a template above.</div> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn className="px-3" onClick={publish}>
            Publish to the crew
          </Btn>
          <Btn
            variant="ghost"
            className="px-3 text-neutral-400"
            onClick={() =>
              window.confirm('Reset tonight’s progress back to the first block?') &&
              save((x) => {
                x.runIdx = 0;
                x.runDone = {};
                x.nightClosed = false;
                x.runAdvancedAt = nowMs();
              })
            }
          >
            Reset tonight’s progress
          </Btn>
        </div>
      </Section>

      <Section
        title="Crew"
        sub="Who serves tonight and where. A name marked out opens their post for the bench."
        right={
          <Btn className="px-3" onClick={() => save((x) => void x.crew.push({ id: uid(), name: 'New volunteer', job: '', post: '', team: null, sendHome: '' }))}>
            + Volunteer
          </Btn>
        }
      >
        <div className="flex flex-col gap-2">
          {h.crew.map((c) => (
            <div key={c.id} className="grid items-center gap-2 sm:grid-cols-[1fr_140px_160px_120px_auto]">
              <input className={cell} defaultValue={c.name} aria-label="Name" onBlur={(e) => patchCrew(c.id, { name: e.target.value.trim() })} />
              <input className={cell} defaultValue={c.job} placeholder="Coach, tech…" aria-label="Job" onBlur={(e) => patchCrew(c.id, { job: e.target.value.trim() })} />
              <input className={cell} defaultValue={c.post} placeholder="Gym floor" aria-label="Post" onBlur={(e) => patchCrew(c.id, { post: e.target.value.trim() })} />
              <select className={cell} value={c.team ?? ''} onChange={(e) => patchCrew(c.id, { team: e.target.value || null })} aria-label="Squad">
                <option value="">No squad</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button aria-label={'Remove ' + c.name} onClick={() => save((x) => void (x.crew = x.crew.filter((y) => y.id !== c.id)))} className="h-9 w-9 rounded-full text-neutral-500">
                <Icon name="ph ph-trash" className="text-[13px]" />
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Bench & open posts"
        sub="People who can step in, and posts nobody is on yet. A leader fills a post from the bench in one tap on the phone."
        right={
          <div className="flex gap-2">
            <Btn variant="secondary" className="px-3" onClick={() => save((x) => void x.bench.push({ id: uid(), name: 'New sub', meta: 'available' }))}>
              + Bench
            </Btn>
            <Btn variant="secondary" className="px-3" onClick={() => save((x) => void x.openPosts.push({ id: uid(), post: 'New post', why: 'not staffed' }))}>
              + Open post
            </Btn>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div className="sr-label">Bench</div>
            {h.bench.map((b) => (
              <div key={b.id} className="flex gap-2">
                <input className={cell + ' flex-1'} defaultValue={b.name} aria-label="Name" onBlur={(e) => save((x) => void (x.bench = x.bench.map((y) => (y.id === b.id ? { ...y, name: e.target.value.trim() } : y))))} />
                <input className={cell + ' w-32'} defaultValue={b.meta} aria-label="Note" onBlur={(e) => save((x) => void (x.bench = x.bench.map((y) => (y.id === b.id ? { ...y, meta: e.target.value.trim() } : y))))} />
                <button aria-label={'Remove ' + b.name} onClick={() => save((x) => void (x.bench = x.bench.filter((y) => y.id !== b.id)))} className="h-9 w-9 rounded-full text-neutral-500">
                  <Icon name="ph ph-trash" className="text-[13px]" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <div className="sr-label">Open posts</div>
            {h.openPosts.map((p) => (
              <div key={p.id} className="flex gap-2">
                <input className={cell + ' flex-1'} defaultValue={p.post} aria-label="Post" onBlur={(e) => save((x) => void (x.openPosts = x.openPosts.map((y) => (y.id === p.id ? { ...y, post: e.target.value.trim() } : y))))} />
                <input className={cell + ' w-32'} defaultValue={p.why} aria-label="Why" onBlur={(e) => save((x) => void (x.openPosts = x.openPosts.map((y) => (y.id === p.id ? { ...y, why: e.target.value.trim() } : y))))} />
                <button aria-label={'Remove ' + p.post} onClick={() => save((x) => void (x.openPosts = x.openPosts.filter((y) => y.id !== p.id)))} className="h-9 w-9 rounded-full text-neutral-500">
                  <Icon name="ph ph-trash" className="text-[13px]" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section
        title="Ready check"
        sub="Ticked on the phones before doors. It resets when you publish the run sheet."
        right={
          <Btn variant="secondary" className="px-3" onClick={() => save((x) => void x.ready.push({ id: uid(), label: 'New item', who: 'You', done: false }))}>
            + Item
          </Btn>
        }
      >
        <div className="flex flex-col gap-2">
          {h.ready.map((r) => (
            <div key={r.id} className="flex gap-2">
              <input className={cell + ' flex-1'} defaultValue={r.label} aria-label="Item" onBlur={(e) => save((x) => void (x.ready = x.ready.map((y) => (y.id === r.id ? { ...y, label: e.target.value.trim() } : y))))} />
              <input className={cell + ' w-36'} defaultValue={r.who} aria-label="Who" onBlur={(e) => save((x) => void (x.ready = x.ready.map((y) => (y.id === r.id ? { ...y, who: e.target.value.trim() } : y))))} />
              <button aria-label={'Remove ' + r.label} onClick={() => save((x) => void (x.ready = x.ready.filter((y) => y.id !== r.id)))} className="h-9 w-9 rounded-full text-neutral-500">
                <Icon name="ph ph-trash" className="text-[13px]" />
              </button>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

/* Publish on a schedule: the day before at 4:00 PM, say. The sheet as it
   stands then is what goes out (lib/sheet-schedule). */
function SheetScheduler() {
  const h = useApp((s) => s.data.huddle);
  const night = useApp((s) => s.data.tonight.date);
  const api = useAppApi();
  const save = useHuddleSave();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(h.sheetSchedule ?? { daysBefore: 1, time: '16:00' });
  if (h.sheetSchedule && !open) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-neutral-800 px-3 py-[10px]">
        <Icon name="ph ph-clock-countdown" className="text-[16px] text-accent-300" />
        <div className="min-w-0 flex-1 text-[12.5px] text-neutral-200">Scheduled · {scheduleSentence(h.sheetSchedule, night)}. The sheet as it stands then is what goes out.</div>
        <Btn variant="ghost" className="px-3" onClick={() => (setDraft(h.sheetSchedule!), setOpen(true))}>
          Change
        </Btn>
        <Btn
          variant="ghost"
          className="px-3"
          onClick={() => {
            save((x) => void (x.sheetSchedule = null));
            api().logActivity('Cancelled the scheduled run sheet publish');
            api().say('Schedule cancelled. Nothing goes out until you publish it yourself.');
          }}
        >
          Cancel schedule
        </Btn>
      </div>
    );
  }
  if (!open) {
    return (
      <Btn variant="secondary" className="self-start px-4" onClick={() => setOpen(true)}>
        <Icon name="ph ph-clock" className="mr-[6px] text-[14px]" />
        Publish on a schedule
      </Btn>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-md border border-neutral-800 p-3">
      <p className="text-[12px] text-neutral-400">Pick when it goes out. The sheet as it stands at that moment is what owners are told about — keep editing until then.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="field">
          <span className="sr-label">When</span>
          <select className="input" value={draft.daysBefore} onChange={(e) => setDraft({ ...draft, daysBefore: Number(e.target.value) })}>
            <option value={0}>The day of the night</option>
            <option value={1}>The day before</option>
            <option value={2}>Two days before</option>
          </select>
        </label>
        <label className="field">
          <span className="sr-label">At</span>
          <input className="input" type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
        </label>
        <Btn
          className="px-4"
          onClick={() => {
            if (!/^\d{2}:\d{2}$/.test(draft.time)) return api().say('Give it a time.');
            save((x) => void (x.sheetSchedule = { ...draft }));
            api().logActivity('Scheduled the run sheet — ' + scheduleSentence(draft, night).toLowerCase());
            api().say(scheduleSentence(draft, night) + '.');
            setOpen(false);
          }}
        >
          Schedule it
        </Btn>
        <Btn variant="ghost" className="px-3" onClick={() => setOpen(false)}>
          Not now
        </Btn>
      </div>
      <p className="text-[11.5px] text-neutral-500">{scheduleSentence(draft, night)}.</p>
    </div>
  );
}
