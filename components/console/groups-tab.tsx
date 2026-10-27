'use client';
/* CONSOLE · SMALL GROUPS — every guide coaches and captains play after
   the game: build one from this week's lesson with Claude, start from a
   template, or copy last week's; pick the week and the squads it's for. */
import { useState } from 'react';
import { Section, useSaveConfig } from '@/components/console/kit';
import { GroupForm, SG_TYPES, saveGroups, sgMinutes } from '@/components/screens/season';
import { Btn, Icon, cx } from '@/components/ui';
import { SG_TEMPLATES, asTemplate, duplicateGroup, fromTemplate } from '@/lib/small-groups';
import type { Draft } from '@/lib/small-group-ai';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import type { SmallGroup } from '@/lib/types/model';

const MODES = [
  { id: 'text', label: 'Paste text', icon: 'ph ph-text-align-left', hint: 'Finished manuscript, half an outline, or three bullets — whatever stage it’s at.' },
  { id: 'file', label: 'File', icon: 'ph ph-file-text', hint: 'A text or Markdown file of your notes.' },
  { id: 'passage', label: 'Passage only', icon: 'ph ph-book-open', hint: 'Just the passage you’re teaching, like Ephesians 2:1–10.' },
  { id: 'topic', label: 'Topic only', icon: 'ph ph-lightbulb', hint: 'A topic or a question, like “What do I do with doubt?”' }
] as const;
type Mode = (typeof MODES)[number]['id'];
const ROOMS = ['Middle school 6–8', 'High school 9–12', 'Mixed 6–12'];

function Builder({ onEdit }: { onEdit: (g: SmallGroup) => void }) {
  const d = useApp((s) => s.data);
  const api = useAppApi();
  const [mode, setMode] = useState<Mode>('text');
  const [lesson, setLesson] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [room, setRoom] = useState(ROOMS[2]);
  const [week, setWeek] = useState(d.config.weekNumber);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [withChallenges, setWithChallenges] = useState(true);

  const generate = async () => {
    if (lesson.trim().length < 3) return setError('Add the lesson, a passage or a topic first.');
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/small-groups/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: mode === 'file' ? 'text' : mode, lesson, minutes, room, week, ministry: d.config.ministryName, tradition: d.plan.settings.tradition, teams: d.teams.map((t) => ({ id: t.id, name: t.name })) })
      });
      const j = (await r.json()) as Draft & { error?: string };
      if (!r.ok || j.error) setError(j.error ?? 'Something went wrong.');
      else setDraft(j);
    } catch {
      setError('The server couldn’t be reached. Try again when you’re online.');
    } finally {
      setBusy(false);
    }
  };

  const keep = (g: SmallGroup) => {
    if (!draft) return;
    saveGroups(api, (list) => [...list, g]);
    if (withChallenges)
      for (const c of draft.challenges) {
        api().mutate((x) => void x.challenges.push(c));
        api().emit({ kind: 'challenge', challenge: c });
      }
    api().logActivity('Built the small group “' + g.title + '” from the week’s lesson');
    api().say('Saved for week ' + g.weekNumber + (withChallenges && draft.challenges.length ? ', with ' + draft.challenges.length + ' squad challenges.' : '.'));
    setDraft(null);
    setLesson('');
  };

  const m = MODES.find((x) => x.id === mode)!;
  return (
    <Section title="Build from this week’s lesson" sub="However far along it is — manuscript, a passage, or just a topic. Claude drafts a session, a challenge for each squad, and a five-day go-deeper week. Nothing saves until you review it, and passages come as references: add the text in your translation.">
      {!draft ? (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="What you have">
            {MODES.map((x) => (
              <button key={x.id} aria-pressed={mode === x.id} onClick={() => setMode(x.id)} className={cx('flex min-h-11 items-center gap-2 rounded-full border px-4 text-[13px]', mode === x.id ? 'border-accent-500 text-accent-100' : 'border-neutral-800 text-neutral-400')}>
                <Icon name={x.icon} className="text-[14px]" />
                {x.label}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-neutral-400">{m.hint}</p>
          {mode === 'file' ? (
            <label className="field">
              <span className="sr-label">Lesson file</span>
              <input
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                className="input py-2"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 60_000) return setError('That file is too long. Paste the main points instead.');
                  setLesson(await f.text());
                  setError('');
                }}
              />
            </label>
          ) : null}
          {mode === 'passage' || mode === 'topic' ? (
            <input aria-label={mode === 'passage' ? 'Passage' : 'Topic'} className="input" value={lesson} onChange={(e) => setLesson(e.target.value)} placeholder={mode === 'passage' ? 'Ephesians 2:1–10' : 'What do I do with doubt?'} />
          ) : (
            <textarea aria-label="Lesson" className="input min-h-[120px] py-2 text-[13px] leading-[1.5]" value={lesson} onChange={(e) => setLesson(e.target.value)} placeholder="Paste the manuscript, the outline, or the three bullets you scribbled in the car." />
          )}
          <div className="flex flex-wrap items-end gap-3">
            <label className="field">
              <span className="sr-label">Length</span>
              <select className="input" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                {[15, 20, 30, 45].map((n) => (
                  <option key={n} value={n}>
                    {n} min
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="sr-label">Room</span>
              <select className="input" value={room} onChange={(e) => setRoom(e.target.value)}>
                {ROOMS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="sr-label">For week</span>
              <select className="input" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
                {Array.from({ length: d.config.seasonWeeks }, (_, k) => (
                  <option key={k} value={k + 1}>
                    Week {k + 1}
                  </option>
                ))}
              </select>
            </label>
            <Btn variant="secondary" className="ml-auto px-4" onClick={generate} disabled={busy}>
              <Icon name={busy ? 'ph ph-circle-notch animate-spin' : 'ph ph-sparkle'} className="mr-[6px] text-[14px]" />
              {busy ? 'Drafting…' : 'Generate draft'}
            </Btn>
          </div>
          {error ? (
            <p role="alert" className="text-[12.5px] text-[#e0a3a3]">
              {error}
            </p>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col gap-3 rounded-md border border-accent-700 p-4">
          <div className="flex items-baseline gap-2">
            <span className="rounded-full border border-dashed border-accent-500 px-2 py-[2px] text-[10.5px] font-semibold uppercase tracking-[.1em] text-accent-200">Draft</span>
            <h3 className="flex-1 text-[15px] font-medium text-neutral-100">{draft.group.title}</h3>
            <span className="text-[12px] text-neutral-400">
              Week {draft.group.weekNumber} · {draft.group.screens.length} screens · about {sgMinutes(draft.group.screens)} min
            </span>
          </div>
          {draft.group.notes ? <p className="text-[12.5px] text-neutral-400">{draft.group.notes}</p> : null}
          <ol className="flex flex-col gap-2">
            {draft.group.screens.map((s, k) => {
              const ty = SG_TYPES.find((t) => t.id === s.type) ?? SG_TYPES[0];
              return (
                <li key={s.id} className="flex items-start gap-3 text-[13px]">
                  <span className="tabular w-5 flex-none text-right text-neutral-500">{k + 1}</span>
                  <Icon name={ty.icon} className="mt-[2px] flex-none text-[15px]" style={{ color: ty.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="text-neutral-100">{s.title}</span>
                    {s.ref ? <span className="text-accent-300"> · {s.ref}</span> : null}
                    <span className="block text-[12px] text-neutral-400">{s.body}</span>
                    {s.options?.length ? <span className="block text-[12px] text-neutral-500">{s.options.join(' / ')}</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
          {draft.challenges.length ? (
            <label className="flex items-start gap-3 rounded-md border border-neutral-800 p-3">
              <input type="checkbox" className="mt-1" checked={withChallenges} onChange={(e) => setWithChallenges(e.target.checked)} />
              <span className="flex flex-col gap-1 text-[12.5px]">
                <span className="text-neutral-100">Add a challenge for each squad, for week {draft.group.weekNumber}</span>
                {draft.challenges.map((c) => (
                  <span key={c.id} className="text-neutral-400">
                    <span className="text-neutral-200">{d.teams.find((t) => t.id === c.team)?.name}:</span> {c.title}
                  </span>
                ))}
              </span>
            </label>
          ) : null}
          {draft.group.deepDive ? (
            <div className="rounded-md border border-neutral-800 p-3 text-[12.5px]">
              <div className="text-neutral-100">Go deeper · {draft.group.deepDive.title}</div>
              <div className="text-neutral-400">
                Memory verse {draft.group.deepDive.verseRef} (add the text in your translation when you edit) · {draft.group.deepDive.days.map((x) => x.day + ' ' + x.ref).join(' · ')}
              </div>
            </div>
          ) : null}
          {draft.dropped ? <p className="text-[12px] text-neutral-500">{draft.dropped === 1 ? 'One part' : draft.dropped + ' parts'} broke the rules (a quotation, or a passage without a real reference) and were left out.</p> : null}
          <div className="flex flex-wrap gap-2">
            <Btn className="px-4" onClick={() => keep(draft.group)}>
              Save the guide
            </Btn>
            <Btn variant="secondary" className="px-4" onClick={() => onEdit(draft.group)}>
              Edit before saving
            </Btn>
            <Btn variant="ghost" className="px-3" onClick={() => setDraft(null)}>
              Discard
            </Btn>
          </div>
        </div>
      )}
    </Section>
  );
}

export function GroupsTab() {
  const d = useApp((s) => s.data);
  const api = useAppApi();
  const saveConfig = useSaveConfig();
  const [editing, setEditing] = useState<SmallGroup | null>(null);
  const groups = [...d.smallGroups].sort((a, b) => b.weekNumber - a.weekNumber);
  const saved = d.config.sgTemplates ?? [];
  const week = d.config.weekNumber;
  const patch = (g: SmallGroup, p: Partial<SmallGroup>) => saveGroups(api, (list) => list.map((x) => (x.id === g.id ? { ...x, ...p } : x)));
  const toggleTeam = (g: SmallGroup, id: string) => {
    const on = new Set(g.teams ?? []);
    if (on.has(id)) on.delete(id);
    else on.add(id);
    patch(g, { teams: on.size && on.size < d.teams.length ? d.teams.map((t) => t.id).filter((t) => on.has(t)) : null });
  };

  return (
    <div className="flex flex-col gap-5">
      {editing ? (
        <section className="sr-card flex flex-col gap-3 px-5 py-4" aria-label="Small group editor">
          <h2 className="text-[15px] font-medium text-neutral-100">{d.smallGroups.some((x) => x.id === editing.id) ? 'Edit small group' : 'New small group'}</h2>
          <GroupForm key={editing.id} group={editing} onDone={() => setEditing(null)} />
        </section>
      ) : (
        <Builder onEdit={setEditing} />
      )}

      <Section title="Start from a template" sub="A new guide for this week from a shape that works. Save any guide below as a template to reuse it.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...SG_TEMPLATES.map((t) => ({ t, mine: false })), ...saved.map((t) => ({ t, mine: true }))].map(({ t, mine }) => (
            <div key={t.id} className="flex items-stretch rounded-md border border-neutral-800 hover:border-neutral-700">
              <button data-wraps className="flex min-h-11 flex-1 flex-col items-start px-3 py-2 text-left" onClick={() => setEditing(fromTemplate(t, week, uid))}>
                <span className="text-[13.5px] font-medium text-neutral-100">{t.title}</span>
                <span className="text-[12px] text-neutral-400">
                  {t.screens.length} screens · ~{sgMinutes(t.screens)} min{mine ? ' · yours' : ''}
                </span>
              </button>
              {mine ? (
                <button aria-label={'Remove the template ' + t.title} onClick={() => saveConfig((c) => ({ sgTemplates: (c.sgTemplates ?? []).filter((x) => x.id !== t.id) }), 'Removed the template ' + t.title)} className="flex w-11 items-center justify-center text-neutral-500 hover:text-neutral-200">
                  <Icon name="ph ph-x" className="text-[13px]" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Small groups"
        sub="Coaches and captains play these from Season › Small groups on the phone. A guide for some squads only shows for theirs."
        right={
          <Btn className="px-4" onClick={() => setEditing({ id: uid(), title: '', notes: '', screens: [], weekNumber: week })}>
            <Icon name="ph ph-plus" className="mr-[6px] text-[14px]" />
            New small group
          </Btn>
        }
      >
        {!groups.length ? <p className="text-[13px] text-neutral-500">No guides yet.</p> : null}
        {groups.map((g) => (
          <div key={g.id} role="group" aria-label={'Guide: ' + g.title} className="flex flex-col gap-3 rounded-md border border-neutral-800 px-4 py-3">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-[200px] flex-1">
                <div className="text-[14px] font-medium text-neutral-100">{g.title}</div>
                {g.notes ? <div className="text-[12.5px] text-neutral-400">{g.notes}</div> : null}
                <div className="mt-1 text-[12px] text-neutral-500">
                  {g.screens.length} screens · ~{sgMinutes(g.screens)} min{g.deepDive ? ' · go-deeper week' : ''}
                </div>
              </div>
              <div className="flex gap-1">
                {[
                  { label: 'Duplicate', icon: 'ph ph-copy', run: () => (saveGroups(api, (list) => [...list, duplicateGroup(g, uid)]), api().logActivity('Copied the small group “' + g.title + '”')) },
                  { label: 'Save as template', icon: 'ph ph-bookmark-simple', run: () => saveConfig((c) => ({ sgTemplates: [...(c.sgTemplates ?? []), asTemplate(g, uid)] }), 'Saved “' + g.title + '” as a template') },
                  { label: 'Edit', icon: 'ph ph-pencil-simple', run: () => setEditing(g) },
                  { label: 'Remove', icon: 'ph ph-trash', run: () => window.confirm('Remove “' + g.title + '”?') && (saveGroups(api, (list) => list.filter((x) => x.id !== g.id)), api().logActivity('Removed the small group “' + g.title + '”')) }
                ].map((a) => (
                  <button key={a.label} aria-label={a.label + ' ' + g.title} title={a.label} onClick={a.run} className="flex h-11 w-11 items-center justify-center rounded-md border border-neutral-800 text-neutral-400 hover:text-neutral-100">
                    <Icon name={a.icon} className="text-[15px]" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-[6px]">
              <div className="flex flex-wrap gap-[6px]" role="group" aria-label={'Squads for ' + g.title}>
                <button aria-pressed={!g.teams?.length} onClick={() => patch(g, { teams: null })} className={cx('min-h-8 rounded-full border px-3 text-[12px]', !g.teams?.length ? 'border-accent-500 text-accent-100' : 'border-neutral-800 text-neutral-400')}>
                  All squads
                </button>
                {d.teams.map((t) => {
                  const on = !!g.teams?.includes(t.id);
                  return (
                    <button key={t.id} aria-pressed={on} onClick={() => toggleTeam(g, t.id)} className="min-h-8 rounded-full border px-3 text-[12px]" style={{ borderColor: on ? t.color : 'var(--color-neutral-800)', color: on ? 'var(--color-neutral-100)' : 'var(--color-neutral-400)' }}>
                      {t.name}
                    </button>
                  );
                })}
              </div>
              <label className="ml-auto flex items-center gap-2 text-[12px] text-neutral-400">
                Week
                <select aria-label={'Week for ' + g.title} className="input !min-h-9 w-auto !py-0" value={g.weekNumber} onChange={(e) => patch(g, { weekNumber: Number(e.target.value) })}>
                  {Array.from({ length: d.config.seasonWeeks }, (_, k) => (
                    <option key={k} value={k + 1}>
                      {k + 1}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}
