'use client';
/* Setting up a night's ministry time: where it sits in the run of show,
   the activities in order, and the nine night defaults. Every edit is one
   undo step on the plan, like the rest of the planner. */
import { useState } from 'react';
import { Panel, usePlanSave } from '@/components/planner/kit';
import { Btn, Icon, cx } from '@/components/ui';
import { LIVE_DEFAULTS, LIVE_SETTINGS, LIVE_TEMPLATES, LIVE_TYPES, liveType, timerOf, verseParts, type LiveActivity, type LiveKind, type LiveSettings } from '@/lib/live';
import { orderOf, type Plan } from '@/lib/plan';
import { uid } from '@/lib/store/app-store';
import { useApp } from '@/lib/store/provider';

const USUAL: LiveKind[] = ['trivia', 'this', 'cloud', 'verse', 'tug'];

export function LiveSetup({ night }: { night: string }) {
  const p = useApp((s) => s.data.plan);
  const save = usePlanSave();
  const acts = p.gatherings[night]?.live?.acts ?? [];
  const settings = { ...LIVE_DEFAULTS, ...p.live };
  const [selId, setSel] = useState<string | null>(null);
  const sel = acts.find((a) => a.id === selId) ?? acts[0];
  const edit = (recipe: (acts: LiveActivity[]) => LiveActivity[], label: string, merge?: string) =>
    save(
      (x) => {
        const g = (x.gatherings[night] ??= {});
        g.live ??= { acts: [] };
        g.live.acts = recipe(g.live.acts);
      },
      label,
      merge ? { merge } : undefined
    );
  const patch = (id: string, ch: Partial<LiveActivity>, label: string, merge?: string) => edit((xs) => xs.map((a) => (a.id === id ? { ...a, ...ch } : a)), label, merge);
  const add = (k: LiveKind) => {
    const a = { id: uid(), ...LIVE_TEMPLATES[k]() };
    edit((xs) => [...xs, a], 'Add ' + liveType(k).label.toLowerCase());
    setSel(a.id);
  };
  const order = orderOf(p, night).filter((b) => b.seg === 'main');
  const hasBlock = order.some((b) => b.id === 'ministry' || /ministry time/i.test(b.kind));

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-4">
        <Panel title="Run of show" meta={order.reduce((n, b) => n + b.mins, 0) + ' min'}>
          <div className="flex flex-col gap-1">
            {order.map((b) => {
              const here = b.id === 'ministry' || /ministry time/i.test(b.kind);
              return (
                <div key={b.id} className={cx('flex items-center gap-2 rounded-md px-2 py-[6px] text-[12.5px]', here ? 'bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] text-accent-100' : 'text-neutral-400')}>
                  <span className="flex-1">{b.title ? b.kind + ': ' + b.title : b.kind}</span>
                  {here ? <span className="text-[11px]">{acts.length} live</span> : null}
                  <span className="tabular-nums text-neutral-400">{b.mins}m</span>
                </div>
              );
            })}
          </div>
          {!hasBlock ? (
            <div className="flex flex-col gap-2 border-t border-divider pt-3 text-[12px] leading-[1.5] text-neutral-400">
              Ministry time isn’t in this night’s order yet.
              <Btn variant="secondary" className="self-start px-3 text-[12px]" onClick={() => save((x) => void (x.gatherings[night] = { ...x.gatherings[night], order: withMinistry(x, night) }), 'Add ministry time to the night')}>
                Add it after teaching
              </Btn>
            </div>
          ) : null}
        </Panel>
        <Panel title="Activities" meta={acts.length ? acts.length + '' : ''}>
          {!acts.length ? (
            <div className="flex flex-col gap-2 text-[12.5px] leading-[1.5] text-neutral-400">
              Nothing yet. Start from the usual five and edit them, or add one at a time.
              <Btn className="self-start px-3 text-[12px]" onClick={() => edit(() => USUAL.map((k) => ({ id: uid(), ...LIVE_TEMPLATES[k]() })), 'Start from the usual five')}>
                Start from the usual five
              </Btn>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {acts.map((a, i) => (
                <button key={a.id} onClick={() => setSel(a.id)} aria-pressed={sel?.id === a.id} className={cx('flex items-start gap-2 rounded-md border px-2 py-2 text-left', sel?.id === a.id ? 'border-accent-600 bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]' : 'border-neutral-800')}>
                  <span className="w-4 flex-none text-right text-[11.5px] tabular-nums text-neutral-500">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] text-neutral-500">
                      {liveType(a.type).label}
                      {timerOf(a, settings) ? ' · ' + timerOf(a, settings) + 's' : ''}
                    </span>
                    <span className="block truncate text-[12.5px] text-neutral-100">{a.prompt || 'No prompt yet'}</span>
                  </span>
                  {problem(a) ? <Icon name="ph-fill ph-warning-circle" className="mt-1 text-[13px] text-[oklch(0.72_0.105_66)]" /> : null}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1 border-t border-divider pt-3">
            {LIVE_TYPES.map((t) => (
              <button key={t.id} onClick={() => add(t.id)} className="flex min-h-8 items-center gap-1 rounded-full border border-neutral-800 px-[10px] text-[11.5px] text-neutral-300">
                <Icon name={'ph ' + t.icon} className="text-[12px]" />+ {t.label}
              </button>
            ))}
          </div>
        </Panel>
      </div>

      {sel ? (
        <Editor
          key={sel.id}
          a={sel}
          i={acts.findIndex((x) => x.id === sel.id)}
          n={acts.length}
          settings={settings}
          translation={p.settings.translation}
          patch={(ch, label, merge) => patch(sel.id, ch, label, merge)}
          move={(d) =>
            edit((xs) => {
              const i = xs.findIndex((x) => x.id === sel.id);
              const j = i + d;
              if (j < 0 || j >= xs.length) return xs;
              const out = [...xs];
              [out[i], out[j]] = [out[j], out[i]];
              return out;
            }, 'Move ' + liveType(sel.type).label.toLowerCase() + (d < 0 ? ' earlier' : ' later'))
          }
          remove={() => {
            edit((xs) => xs.filter((x) => x.id !== sel.id), 'Remove ' + liveType(sel.type).label.toLowerCase());
            setSel(null);
          }}
          duplicate={() => {
            const copy = { ...structuredClone(sel), id: uid() };
            edit((xs) => {
              const i = xs.findIndex((x) => x.id === sel.id);
              return [...xs.slice(0, i + 1), copy, ...xs.slice(i + 1)];
            }, 'Duplicate ' + liveType(sel.type).label.toLowerCase());
            setSel(copy.id);
          }}
          retype={(k) => {
            /* Keep what carries over: the prompt, the timer, and answers between trivia and this-or-that. */
            const t = LIVE_TEMPLATES[k]();
            const keepOpts = (k === 'trivia' || k === 'this') && (sel.type === 'trivia' || sel.type === 'this') && sel.options?.length;
            patch(
              sel.id,
              { ...t, prompt: sel.prompt.trim() ? sel.prompt : t.prompt, timer: sel.timer, options: keepOpts ? (k === 'this' ? sel.options!.map(({ l }) => ({ l })) : sel.options) : t.options, verse: k === 'verse' ? (sel.verse ?? t.verse) : undefined },
              'Make it ' + (k === 'this' ? 'a this-or-that' : 'a ' + liveType(k).label.toLowerCase())
            );
          }}
        />
      ) : (
        <Panel title="Pick an activity">
          <div className="text-[12.5px] text-neutral-500">Its prompt, answers and timer open here.</div>
        </Panel>
      )}

      <Panel title="Night defaults" meta="Nine, for every night">
        <div className="flex flex-col gap-4">
          {LIVE_SETTINGS.map((st) => (
            <div key={st.key} className="flex flex-col gap-[6px]">
              <div className="text-[12.5px] text-neutral-200">{st.label}</div>
              <div className="flex flex-wrap gap-1" role="group" aria-label={st.label}>
                {st.opts.map(([v, label]) => {
                  const on = settings[st.key] === v;
                  return (
                    <button
                      key={String(v)}
                      aria-pressed={on}
                      onClick={() => save((x) => void (x.live = { ...LIVE_DEFAULTS, ...x.live, [st.key]: v } as LiveSettings), st.label + ': ' + label, { log: true })}
                      className="min-h-8 rounded-full border px-3 text-[11.5px]"
                      style={{ borderColor: on ? 'var(--color-accent-500)' : 'var(--color-neutral-800)', background: on ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)' : 'transparent', color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-400)' }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="text-[11px] leading-[1.45] text-neutral-500">{st.help}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/** What's wrong with an activity, in plain words — or nothing. */
export function problem(a: LiveActivity): string | null {
  if (!a.prompt.trim()) return 'It has no prompt.';
  if ((a.type === 'trivia' || a.type === 'this') && (a.options ?? []).filter((o) => o.l.trim()).length < 2) return 'It needs at least two answers.';
  if (a.type === 'trivia' && !(a.options ?? []).some((o) => o.correct)) return 'No answer is marked right, so nobody can score.';
  if (a.type === 'verse' && !verseParts(a.verse).some((p) => p.blank)) return 'Put [brackets] around the words to blank out.';
  return null;
}

function withMinistry(p: Plan, night: string) {
  const order = orderOf(p, night).filter((b) => b.id !== 'ministry');
  const at = order.findIndex((b) => b.id === 'teaching');
  const block = { id: 'ministry', seg: 'main' as const, kind: 'Ministry time', title: '', mins: p.blocks.find((b) => b.id === 'ministry')?.mins ?? 10, lead: null };
  return [...order.slice(0, at + 1), block, ...order.slice(at + 1)];
}

function Editor({ a, i, n, settings, translation, patch, move, remove, duplicate, retype }: { a: LiveActivity; i: number; n: number; settings: LiveSettings; translation: string; patch: (ch: Partial<LiveActivity>, label: string, merge?: string) => void; move: (d: number) => void; remove: () => void; duplicate: () => void; retype: (k: LiveKind) => void }) {
  const t = liveType(a.type);
  const issue = problem(a);
  const opts = a.options ?? [];
  const setOpt = (j: number, ch: Partial<{ l: string; correct: boolean }>, label: string, merge?: string) => patch({ options: opts.map((o, k) => (k === j ? { ...o, ...ch } : ch.correct ? { ...o, correct: false } : o)) }, label, merge);
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Icon name={'ph ' + t.icon} className="text-[15px] text-accent-300" />
          {i + 1}. {t.label}
        </span>
      }
      right={
        <div className="flex gap-1">
          <button onClick={() => move(-1)} disabled={i === 0} aria-label="Earlier" className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-800 text-neutral-400 disabled:opacity-30">
            <Icon name="ph ph-arrow-up" className="text-[12px]" />
          </button>
          <button onClick={() => move(1)} disabled={i === n - 1} aria-label="Later" className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-800 text-neutral-400 disabled:opacity-30">
            <Icon name="ph ph-arrow-down" className="text-[12px]" />
          </button>
          <button onClick={duplicate} aria-label="Duplicate" title="Duplicate" className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-800 text-neutral-400">
            <Icon name="ph ph-copy" className="text-[12px]" />
          </button>
          <button onClick={remove} aria-label="Remove" className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-800 text-neutral-400">
            <Icon name="ph ph-trash" className="text-[12px]" />
          </button>
        </div>
      }
    >
      <div className="flex flex-wrap gap-1" role="group" aria-label="Activity">
        {LIVE_TYPES.map((k) => (
          <button
            key={k.id}
            onClick={() => k.id !== a.type && retype(k.id)}
            aria-pressed={k.id === a.type}
            className="min-h-8 rounded-full border px-3 text-[11.5px]"
            style={{ borderColor: k.id === a.type ? 'var(--color-accent-500)' : 'var(--color-neutral-800)', background: k.id === a.type ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)' : 'transparent', color: k.id === a.type ? 'var(--color-accent-100)' : 'var(--color-neutral-400)' }}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="text-[12px] leading-[1.5] text-neutral-500">{t.note}</div>
      <label className="flex flex-col gap-1">
        <span className="sr-label">Prompt</span>
        <input className="input text-[15px]" value={a.prompt} onChange={(e) => patch({ prompt: e.target.value }, 'Edit the prompt', 'prompt:' + a.id)} />
      </label>
      {a.type === 'trivia' || a.type === 'this' ? (
        <div className="flex flex-col gap-2">
          <span className="sr-label">{a.type === 'trivia' ? 'Answers · mark the right one' : 'Sides'}</span>
          {opts.map((o, j) => (
            <div key={j} className="flex items-center gap-2">
              {a.type === 'trivia' ? (
                <button onClick={() => setOpt(j, { correct: true }, 'Mark the right answer')} aria-pressed={!!o.correct} aria-label={'Mark answer ' + (j + 1) + ' right'} className="flex h-9 w-9 flex-none items-center justify-center rounded-full border" style={{ borderColor: o.correct ? 'var(--color-accent-400)' : 'var(--color-neutral-700)', color: o.correct ? 'var(--color-accent-200)' : 'var(--color-neutral-600)' }}>
                  <Icon name={o.correct ? 'ph-fill ph-check-circle' : 'ph ph-circle'} className="text-[15px]" />
                </button>
              ) : null}
              <input className="input flex-1" value={o.l} placeholder={'Answer ' + (j + 1)} onChange={(e) => setOpt(j, { l: e.target.value }, 'Edit an answer', 'opt:' + a.id + j)} />
              <button onClick={() => patch({ options: opts.filter((_, k) => k !== j) }, 'Remove an answer')} disabled={opts.length <= 2} aria-label={'Remove answer ' + (j + 1)} className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-neutral-500 disabled:opacity-30">
                <Icon name="ph ph-x" className="text-[13px]" />
              </button>
            </div>
          ))}
          {opts.length < 6 ? (
            <button onClick={() => patch({ options: [...opts, { l: '' }] }, 'Add an answer')} className="self-start text-[12px] text-accent-300">
              + Add an answer
            </button>
          ) : null}
        </div>
      ) : null}
      {a.type === 'verse' ? (
        <label className="flex flex-col gap-1">
          <span className="sr-label">Verse · {translation}</span>
          <textarea className="input min-h-[110px] py-2 leading-[1.5]" value={a.verse ?? ''} onChange={(e) => patch({ verse: e.target.value }, 'Edit the verse', 'verse:' + a.id)} />
          <span className="text-[11.5px] leading-[1.5] text-neutral-500">
            Type it from your ministry’s Bible ({translation}) — nothing is filled in for you. Brackets mark the blanks: {verseParts(a.verse).filter((p) => p.blank).length || 'none yet'}.
          </span>
        </label>
      ) : null}
      {a.type === 'tug' ? <div className="text-[12px] leading-[1.5] text-neutral-400">Sides come from the night’s setting: {settings.teams === 'squads' ? 'squads, alternating' : settings.teams === 'grade' ? 'younger grades against older' : 'a stable coin flip per phone'}.</div> : null}
      {a.type === 'cloud' ? <div className="text-[12px] leading-[1.5] text-neutral-400">{settings.approve === 'on' ? 'Each word waits for a leader’s tap before the screen shows it.' : 'Words go straight to the screen tonight — approval is off in the night defaults.'}</div> : null}
      <label className="flex flex-col gap-1">
        <span className="sr-label">Timer</span>
        <select
          className="input"
          value={String(a.timer)}
          onChange={(e) => patch({ timer: e.target.value === 'night' ? 'night' : Number(e.target.value) }, 'Change the timer')}
        >
          <option value="night">Night default ({settings.timer ? settings.timer + 's' : 'none'})</option>
          {[0, 10, 15, 20, 30, 45, 60].map((s) => (
            <option key={s} value={s}>
              {s ? s + ' seconds' : 'No timer'}
            </option>
          ))}
        </select>
      </label>
      {issue ? (
        <div className="flex items-start gap-2 rounded-md border border-[oklch(0.72_0.105_66)] px-3 py-2 text-[12px] text-neutral-200">
          <Icon name="ph-fill ph-warning-circle" className="mt-[2px] text-[13px] text-[oklch(0.72_0.105_66)]" />
          {issue}
        </div>
      ) : null}
    </Panel>
  );
}
