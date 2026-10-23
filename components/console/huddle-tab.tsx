'use client';
/* The huddle sheet: tonight's running order, who serves where, who is on
   the bench, the open posts and the ready check. The phones' Huddle and the
   Home Tonight card read exactly this. */
import { Section } from '@/components/console/kit';
import { useHuddleSave } from '@/components/screens/huddle';
import { Btn, Icon } from '@/components/ui';
import { nowMs } from '@/lib/dates';
import { uid } from '@/lib/store/app-store';
import { useApp } from '@/lib/store/provider';
import type { CrewMember, RunSheetItem } from '@/lib/types/model';

const cell = 'input !min-h-9 !py-0';

export function HuddleTab() {
  const h = useApp((s) => s.data.huddle);
  const teams = useApp((s) => s.data.teams);
  const save = useHuddleSave();
  const patchItem = (id: string, p: Partial<RunSheetItem>) => save((x) => void (x.runSheet = x.runSheet.map((it) => (it.id === id ? { ...it, ...p } : it))));
  const patchCrew = (id: string, p: Partial<CrewMember>) => save((x) => void (x.crew = x.crew.map((c) => (c.id === id ? { ...c, ...p } : c))));
  const move = (i: number, dir: -1 | 1) =>
    save((x) => {
      const j = i + dir;
      if (j < 0 || j >= x.runSheet.length) return;
      [x.runSheet[i], x.runSheet[j]] = [x.runSheet[j], x.runSheet[i]];
    });

  return (
    <>
      <Section
        title="Run sheet"
        sub="Tonight in order. The phone holding the huddle advances it and every other phone follows."
        right={
          <Btn className="px-3" onClick={() => save((x) => void x.runSheet.push({ id: uid(), time: '', label: 'New block', where: '', who: '', detail: '', assignedTo: null, notifiedAt: null }))}>
            + Block
          </Btn>
        }
      >
        <div className="flex flex-col gap-2">
          {h.runSheet.map((it, i) => (
            <div key={it.id} className="grid items-center gap-2 rounded-md border border-neutral-800 p-2 sm:grid-cols-[80px_1fr_140px_120px_auto]">
              <input className={cell} defaultValue={it.time} placeholder="6:45p" aria-label="Time" onBlur={(e) => patchItem(it.id, { time: e.target.value.trim() })} />
              <input className={cell} defaultValue={it.label} aria-label="What" onBlur={(e) => patchItem(it.id, { label: e.target.value.trim() })} />
              <input className={cell} defaultValue={it.where} placeholder="Where" aria-label="Where" onBlur={(e) => patchItem(it.id, { where: e.target.value.trim() })} />
              <select className={cell} value={it.assignedTo ?? ''} onChange={(e) => patchItem(it.id, { assignedTo: e.target.value || null, who: h.crew.find((c) => c.id === e.target.value)?.name ?? it.who })} aria-label="Who owns it">
                <option value="">Owner…</option>
                {h.crew.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-1">
                <button aria-label="Move up" onClick={() => move(i, -1)} className="h-9 w-9 rounded-full text-neutral-400">
                  <Icon name="ph ph-arrow-up" className="text-[13px]" />
                </button>
                <button aria-label="Move down" onClick={() => move(i, 1)} className="h-9 w-9 rounded-full text-neutral-400">
                  <Icon name="ph ph-arrow-down" className="text-[13px]" />
                </button>
                <button aria-label="Delete block" onClick={() => save((x) => void (x.runSheet = x.runSheet.filter((y) => y.id !== it.id)))} className="h-9 w-9 rounded-full text-neutral-500">
                  <Icon name="ph ph-trash" className="text-[13px]" />
                </button>
              </div>
              <input className={cell + ' sm:col-span-5'} defaultValue={it.detail} placeholder="Notes for whoever runs it" aria-label="Notes" onBlur={(e) => patchItem(it.id, { detail: e.target.value.trim() })} />
            </div>
          ))}
          {!h.runSheet.length ? <div className="text-[12px] text-neutral-500">No blocks yet. Doors, games, the Word, small groups, send-home.</div> : null}
        </div>
        <div className="flex gap-2">
          <Btn
            variant="secondary"
            className="px-3"
            onClick={() =>
              save((x) => {
                x.runIdx = 0;
                x.runDone = {};
                x.nightClosed = false;
                x.runAdvancedAt = nowMs();
                for (const it of x.runSheet) it.notifiedAt = it.assignedTo ? nowMs() : null;
              })
            }
          >
            Publish to the crew
          </Btn>
          <span className="self-center text-[11.5px] text-neutral-500">Resets tonight’s progress and tells each owner what they run.</span>
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
