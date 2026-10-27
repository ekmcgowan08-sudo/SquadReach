'use client';
/* CONSOLE · CHALLENGES — the pushes on the phone's Races screen, set up
   here: a squad or individual push, its words, what it's worth, and the
   weeks it runs. One with a squad, a category and an amount posts its
   points through award() when it's marked ready and someone pushes it on
   the phone; without them it's a goal the coaches confirm by hand. */
import { useState } from 'react';
import { Section } from '@/components/console/kit';
import { Btn, Icon, cx } from '@/components/ui';
import { challengesIn } from '@/lib/feeds';
import { fmt } from '@/lib/scoring';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import type { Challenge } from '@/lib/types/model';

/** A text box that saves when you leave it, so typing doesn't sync per key. */
function Blur({ value, onSave, label, area, placeholder, className }: { value: string; onSave: (v: string) => void; label: string; area?: boolean; placeholder?: string; className?: string }) {
  const [v, setV] = useState(value);
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setV(value);
  }
  const commit = () => v.trim() !== value && onSave(v.trim());
  return area ? (
    <textarea aria-label={label} className={cx('input min-h-[64px] py-2 text-[13px] leading-[1.5]', className)} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} />
  ) : (
    <input aria-label={label} className={cx('input', className)} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
  );
}

/** "All season", "Weeks 3–4", "Weeks 2, 5 and 7", or "Paused". */
export function weeksLabel(weeks: number[] | null | undefined): string {
  if (!weeks) return 'All season';
  if (!weeks.length) return 'Paused';
  const w = [...weeks].sort((a, b) => a - b);
  if (w.length === 1) return 'Week ' + w[0];
  if (w[w.length - 1] - w[0] === w.length - 1) return 'Weeks ' + w[0] + '–' + w[w.length - 1];
  return 'Weeks ' + w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1];
}

export function ChallengesTab() {
  const d = useApp((s) => s.data);
  const api = useAppApi();
  const weeks = Array.from({ length: d.config.seasonWeeks }, (_, i) => i + 1);
  const now = challengesIn(d.challenges, d.config.weekNumber).length;
  const save = (c: Challenge, note?: string) => {
    api().mutate((x) => {
      const i = x.challenges.findIndex((y) => y.id === c.id);
      if (i >= 0) x.challenges[i] = c;
      else x.challenges.push(c);
    });
    api().emit({ kind: 'challenge', challenge: c });
    if (note) api().logActivity(note);
  };
  const remove = (c: Challenge) => {
    if (!window.confirm('Remove “' + c.title + '”? Points it already posted stay in the ledger.')) return;
    api().mutate((x) => void (x.challenges = x.challenges.filter((y) => y.id !== c.id)));
    api().emit({ kind: 'challengeRemove', id: c.id });
    api().logActivity('Removed the challenge “' + c.title + '”');
  };
  /* Weeks as on/off chips: no list means every week. */
  const toggleWeek = (c: Challenge, w: number) => {
    const on = new Set(c.weeks ?? weeks);
    if (on.has(w)) on.delete(w);
    else on.add(w);
    const next = on.size === weeks.length ? null : [...on].sort((a, b) => a - b);
    save({ ...c, weeks: next }, '“' + c.title + '” now runs: ' + weeksLabel(next).toLowerCase());
  };

  return (
    <div className="flex flex-col gap-5">
      <Section
        title="Challenges"
        sub={'Squad and individual pushes on the Races screen. Give one a squad, a category and an amount and it posts its points when it’s marked ready and someone pushes it. ' + now + (now === 1 ? ' runs' : ' run') + ' this week.'}
        right={
          <Btn className="px-4" onClick={() => save({ id: uid(), kind: 'Team', title: 'New challenge', body: '', pointsLabel: '', status: '', done: false }, 'Added a challenge')}>
            <Icon name="ph ph-plus" className="mr-[6px] text-[14px]" />
            Add challenge
          </Btn>
        }
      >
        {!d.challenges.length ? <p className="text-[13px] text-neutral-500">No challenges yet. Add one, and it shows on the phone’s Races screen in the weeks you pick.</p> : null}
      </Section>
      {d.challenges.map((c) => {
        const live = c.team && c.cat && c.amount;
        const pushed = !!d.tonight.pushed[c.id];
        return (
          <section key={c.id} className="sr-card flex flex-col gap-3 px-5 py-4" aria-label={'Challenge: ' + c.title}>
            <div className="flex items-center gap-2">
              <select aria-label="Kind" className="input w-[140px]" value={c.kind} onChange={(e) => save({ ...c, kind: e.target.value as Challenge['kind'] })}>
                <option value="Team">Squad</option>
                <option value="Individual">Individual</option>
              </select>
              <Blur label="Title" value={c.title} onSave={(v) => v && save({ ...c, title: v }, 'Renamed a challenge to “' + v + '”')} className="flex-1" />
              <button aria-label={'Remove ' + c.title} onClick={() => remove(c)} className="flex h-11 w-11 flex-none items-center justify-center rounded-md border border-neutral-800 text-neutral-500 hover:text-neutral-200">
                <Icon name="ph ph-trash" className="text-[15px]" />
              </button>
            </div>
            <Blur label="What it asks" area value={c.body} placeholder="What it asks, and how it’s counted" onSave={(v) => save({ ...c, body: v })} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Blur label="What it’s worth, as students see it" value={c.pointsLabel} placeholder="1,200 pts" onSave={(v) => save({ ...c, pointsLabel: v })} />
              <Blur label="Progress line" value={c.status} placeholder="9 of 12 invites logged" onSave={(v) => save({ ...c, status: v })} />
            </div>
            <div className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_120px_auto]">
              <select aria-label="Squad it pays" className="input" value={c.team ?? ''} onChange={(e) => save({ ...c, team: e.target.value || undefined })}>
                <option value="">No squad (individual)</option>
                {d.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select aria-label="Category it posts to" className="input" value={c.cat ?? ''} onChange={(e) => save({ ...c, cat: e.target.value || undefined })}>
                <option value="">No auto-post category</option>
                {d.cats.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
              <input
                aria-label="Points it posts"
                className="input"
                type="number"
                min={0}
                step={50}
                defaultValue={c.amount ?? 0}
                key={'amt' + c.amount}
                onBlur={(e) => Number(e.target.value) !== (c.amount ?? 0) && save({ ...c, amount: Math.max(0, Number(e.target.value) || 0) || undefined })}
              />
              <label className="flex min-h-11 items-center gap-2 px-1 text-[13px] text-neutral-300">
                <input type="checkbox" checked={c.done} onChange={(e) => save({ ...c, done: e.target.checked }, (e.target.checked ? 'Marked ready to push: ' : 'Not ready yet: ') + c.title)} />
                Ready to push
              </label>
            </div>
            <div className="text-[12px] leading-[1.5] text-neutral-500">
              {live
                ? pushed
                  ? 'Pushed tonight: ' + fmt(c.amount!) + ' ' + (d.cats.find((k) => k.id === c.cat)?.label ?? c.cat) + ' points to ' + (d.teams.find((t) => t.id === c.team)?.name ?? 'the squad') + '.'
                  : (c.done ? 'Ready: the Races screen can push ' : 'Once it’s ready, the Races screen pushes ') + fmt(c.amount!) + ' ' + (d.cats.find((k) => k.id === c.cat)?.label ?? c.cat) + ' points to ' + (d.teams.find((t) => t.id === c.team)?.name ?? 'the squad') + ', through the ledger like any other points.'
                : 'Nothing posts on its own: coaches confirm it, and points go in from the score pad.'}
            </div>
            <div className="flex flex-wrap items-center gap-[6px]">
              <span className="mr-1 text-[12px] text-neutral-400">Runs: {weeksLabel(c.weeks)}</span>
              <button onClick={() => save({ ...c, weeks: null }, '“' + c.title + '” runs all season')} aria-pressed={!c.weeks} className={cx('min-h-9 rounded-md border px-3 text-[12px]', !c.weeks ? 'border-accent-500 text-accent-100' : 'border-neutral-800 text-neutral-400')}>
                All
              </button>
              <button onClick={() => save({ ...c, weeks: [] }, '“' + c.title + '” is paused')} aria-pressed={!!c.weeks && !c.weeks.length} className={cx('min-h-9 rounded-md border px-3 text-[12px]', c.weeks && !c.weeks.length ? 'border-accent-500 text-accent-100' : 'border-neutral-800 text-neutral-400')}>
                None
              </button>
              {weeks.map((w) => {
                const on = !c.weeks || c.weeks.includes(w);
                return (
                  <button
                    key={w}
                    onClick={() => toggleWeek(c, w)}
                    aria-pressed={on}
                    aria-label={'Week ' + w}
                    className={cx('min-h-9 min-w-9 rounded-md border px-2 text-[12px] tabular-nums', on ? 'border-accent-600 text-accent-100' : 'border-neutral-800 text-neutral-500', w === d.config.weekNumber && 'font-semibold')}
                    style={{ background: on ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : undefined }}
                  >
                    {w}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
