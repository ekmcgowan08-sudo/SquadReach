'use client';
/* Console · Season builder — questions in, a season out. One question per
   screen, a review of the whole season with "Change" on every row, then
   save. Saved seasons can be made live, reviewed, or copied forward. */
import Link from 'next/link';
import { useState } from 'react';
import { Section, useSaveConfig } from '@/components/console/kit';
import { PastSeasons } from '@/components/console/past-seasons';
import { Btn, Icon } from '@/components/ui';
import { isoDay, nowMs } from '@/lib/dates';
import { CARRY_LINE, DRAFT_DEFAULTS, carrySquads, draftOrder, squadCarry } from '@/lib/draft';
import {
  SEASON_GROUPS, SEASON_QUESTIONS, answerLabel, answerOf, nextSeasonName, planStartFor, planYears, scoringOn, seasonAnswered, seasonSettings, withPlan, yearPlan,
  type SavedSeason, type SeasonAnswer, type SeasonAnswers
} from '@/lib/season';
import { seasonResult, withResult } from '@/lib/season-results';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';

type Draft = { id: string; answers: SeasonAnswers; step: number | 'review'; returnToReview: boolean };

export function SeasonTab() {
  const d = useApp((s) => s.data);
  const api = useAppApi();
  const saveConfig = useSaveConfig();
  const [draft, setDraft] = useState<Draft | null>(null);
  const today = isoDay(new Date());

  const saveSeasons = (next: SavedSeason[]) => {
    api().mutate((x) => void (x.seasons = next));
    api().emit({ kind: 'doc', key: 'seasons', value: next });
  };
  const makeLive = (s: SavedSeason) => {
    if (s.plan?.draft) return api().say('Confirm ' + s.plan.year + ' first — a year of the plan stays a draft until someone does.');
    const set = seasonSettings(s.answers, d.config, today);
    const current = d.config.seasonName;
    /* A season with no leaderboard has no finish to record. */
    const record = scoringOn(d.config) && current && current !== s.name && !(d.config.seasonResults ?? []).some((r) => r.name === current);
    /* Squads only change for a new season — making the live one live again is a no-op. */
    const fresh = !s.active;
    const how = squadCarry(seasonAnswered(s.answers, 'assign') ? String(s.answers.assign) : undefined, d.config.draft?.dynasty);
    if (!window.confirm('Make ' + s.name + ' the live season? Meeting nights become ' + set.meetingDates!.length + ' weeks from ' + set.meetingDates![0] + '. Points already on the board stay where they are.' + (fresh ? ' ' + CARRY_LINE[how] : '') + (record ? ' How ' + current + ' finished is recorded in Past seasons first.' : ''))) return;
    if (record) saveConfig((c) => ({ seasonResults: withResult(c.seasonResults, seasonResult(api().data, today)) }), 'Recorded how ' + current + ' finished');
    saveConfig(set, 'Made ' + s.name + ' the live season');
    if (fresh) {
      const teamIds = api().data.teams.map((t) => t.id);
      const moved = carrySquads(api().data.roster, teamIds, how);
      api().mutate((x) => {
        for (const m of moved) {
          const r = x.roster.find((y) => y.id === m.id);
          if (r) Object.assign(r, { team: m.team, captain: m.captain });
        }
      });
      for (const m of moved) api().emit({ kind: 'student', student: m });
      saveConfig((c) => ({ draft: { ...DRAFT_DEFAULTS(teamIds), ...c.draft, order: draftOrder(c.draft, teamIds), live: null, picks: [], dynasty: how === 'keep' ? true : how === 'draft' ? false : c.draft?.dynasty } }));
      if (moved.length) api().logActivity(how === 'draft' ? 'Put all ' + moved.length + ' students back in the draft pool for ' + s.name : 'Dealt ' + moved.length + ' students onto squads for ' + s.name + ', balanced by grade');
    }
    /* The list as it stands now — a season saved a moment ago included. */
    saveSeasons(api().data.seasons.map((x) => ({ ...x, active: x.id === s.id })));
    api().say(s.name + ' is live. ' + set.meetingDates!.length + ' nights are on the calendar.' + (fresh && how === 'draft' ? ' Everyone’s in the draft pool for draft night.' : ''));
  };

  if (draft) return <Interview draft={draft} setDraft={setDraft} onSave={(answers, live) => {
    const name = String(answerOf(answers, SEASON_QUESTIONS[0], today)).trim() || 'Season';
    const rec: SavedSeason = { id: draft.id, name, answers, active: false, savedAt: nowMs() };
    const exists = d.seasons.some((x) => x.id === rec.id);
    const list = exists ? d.seasons.map((x) => (x.id === rec.id ? { ...rec, active: x.active, ...(x.plan ? { plan: x.plan } : {}) } : x)) : [rec, ...d.seasons];
    saveSeasons(list);
    api().logActivity('Saved the season interview: ' + name);
    setDraft(null);
    if (live) makeLive(list.find((x) => x.id === rec.id)!);
    else api().say(name + ' is saved.');
  }} />;

  return (
    <>
      <Section
        title="Season builder"
        sub="Seventeen questions about how you actually run your ministry. Skip anything and the common answer fills in, marked as a default. The last screen is the whole season in one place."
        right={
          <Btn className="px-3" onClick={() => setDraft({ id: uid(), answers: {}, step: 0, returnToReview: false })}>
            + Build a season
          </Btn>
        }
      >
        {!d.seasons.some((s) => !s.plan) ? <div className="text-[12px] text-neutral-500">No seasons saved yet.</div> : null}
        <div className="flex flex-col gap-2">
          {d.seasons.filter((s) => !s.plan).map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-800 px-3 py-[10px]">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[13.5px] font-medium text-neutral-100">
                  {s.name}
                  {s.active ? <span className="rounded-full bg-accent-700 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[.08em] text-accent-100">Live</span> : null}
                </div>
                <div className="mt-[2px] text-[11px] text-neutral-500">
                  {String(answerOf(s.answers, SEASON_QUESTIONS.find((q) => q.id === 'weeks')!, today))} weeks · {Object.keys(s.answers).filter((k) => seasonAnswered(s.answers, k)).length} of {SEASON_QUESTIONS.length} answered · saved {new Date(s.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
              {!s.active ? (
                <Btn variant="secondary" className="px-3 text-[12px]" onClick={() => makeLive(s)}>
                  Make this the live season
                </Btn>
              ) : null}
              <Btn variant="ghost" className="px-3 text-[12px]" onClick={() => setDraft({ id: s.id, answers: { ...s.answers }, step: 'review', returnToReview: true })}>
                Review the answers
              </Btn>
              <Btn
                variant="ghost"
                className="px-3 text-[12px]"
                onClick={() => {
                  const answers: SeasonAnswers = { ...s.answers, name: nextSeasonName(s.name) };
                  delete answers.start;
                  setDraft({ id: uid(), answers, step: 'review', returnToReview: true });
                }}
              >
                Start next season from this
              </Btn>
              <button
                aria-label={'Delete ' + s.name}
                onClick={() => {
                  if (s.active) return api().say('That’s the live season. Make another one live first.');
                  if (window.confirm('Delete ' + s.name + '? Its answers go with it.')) saveSeasons(d.seasons.filter((x) => x.id !== s.id));
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500"
              >
                <Icon name="ph ph-trash" className="text-[14px]" />
              </button>
            </div>
          ))}
        </div>
      </Section>
      <YearPlan seasons={d.seasons} save={saveSeasons} makeLive={makeLive} review={(s) => setDraft({ id: s.id, answers: { ...s.answers }, step: 'review', returnToReview: true })} />
      <PastSeasons />
    </>
  );
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const day = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/* Three seasons a year, one scored, across the horizon — each year a draft
   until a leader confirms it. */
function YearPlan({ seasons, save, makeLive, review }: { seasons: SavedSeason[]; save: (s: SavedSeason[]) => void; makeLive: (s: SavedSeason) => void; review: (s: SavedSeason) => void }) {
  const api = useAppApi();
  const today = isoDay(new Date());
  const live = seasons.find((s) => s.active);
  const lastNight = String(live?.answers.night ?? 'Wednesday');
  const [years, setYears] = useState(7);
  const [night, setNight] = useState(DAYS.includes(lastNight) ? lastNight : 'Wednesday');
  const [start, setStart] = useState(() => planStartFor(today, DAYS.includes(lastNight) ? lastNight : 'Wednesday'));
  const [open, setOpen] = useState<number | null>(null);
  const rows = planYears(seasons);
  const has = rows.length > 0;
  const inPlan = seasons.filter((s) => s.plan);

  const build = () => {
    if (!start || isNaN(Date.parse(start))) return api().say('Pick the first Winter/Spring night.');
    if (has && !window.confirm('Rebuild the plan? Its ' + inPlan.length + ' seasons are replaced. Seasons you saved from the questions, and the one running now, stay.')) return;
    const plan = yearPlan(years, start, night, uid, nowMs());
    save(withPlan(seasons, plan));
    setOpen(1);
    api().logActivity('Built a ' + years + '-year plan: three seasons a year, one scored');
    api().say(years + (years === 1 ? ' year' : ' years') + ' built — ' + plan.length + ' seasons, ' + years + ' of them scored. Each year stays a draft until you confirm it.');
  };
  const clear = () => {
    if (!window.confirm('Clear the plan? Its draft and confirmed seasons go. Seasons you saved from the questions, and the one running now, stay.')) return;
    save(withPlan(seasons, []));
    setOpen(null);
    api().logActivity('Cleared the multi-year plan');
    api().say('Plan cleared. Saved and running seasons were left alone.');
  };
  const confirmYear = (idx: number, year: number) => {
    save(seasons.map((s) => (s.plan?.idx === idx ? { ...s, plan: { ...s.plan, draft: false } } : s)));
    api().logActivity('Confirmed ' + year + ' of the plan');
    api().say(year + ' confirmed. Those seasons are ready — make one live when its first night comes.');
  };

  return (
    <Section
      title="Build the whole horizon at once"
      sub="Three seasons a year, one of them scored. Winter/Spring carries the points; Summer and Fall/Winter run as regular programming — huddles, run of show and follow-up, no leaderboard. Every year after the first is the same shape 52 weeks on, and each year stays a draft until you confirm it."
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="field w-[110px]">
          <span className="sr-label">Years</span>
          <input className="input" type="number" min={1} max={10} value={years} onChange={(e) => setYears(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} />
        </label>
        <label className="field">
          <span className="sr-label">First Winter/Spring night</span>
          <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field">
          <span className="sr-label">Night you meet</span>
          <select className="input" value={night} onChange={(e) => setNight(e.target.value)}>
            {DAYS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <Btn className="px-4" onClick={build}>
          {has ? 'Rebuild the plan' : 'Build ' + years + (years === 1 ? ' year' : ' years')}
        </Btn>
      </div>
      <div className="text-[11.5px] leading-[1.5] text-neutral-500 text-pretty">The first night snaps to the night you meet. Making a season live sets the calendar’s meeting nights and week numbers from it, and whether there’s a leaderboard at all.</div>
      {has ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 text-[12px] font-medium text-neutral-200">
              {inPlan.length} seasons · {inPlan.filter((s) => s.plan!.scored).length} scored · {rows[0].year}–{rows[rows.length - 1].year}
            </div>
            <Btn variant="ghost" className="px-3 text-[12px]" onClick={clear}>
              Clear the plan
            </Btn>
          </div>
          {rows.map((y, i) => {
            const isOpen = open === y.idx;
            return (
              <div key={y.idx} className="rounded-md border border-neutral-800">
                <div className="flex items-center gap-2 px-3 py-[6px]">
                  <button onClick={() => setOpen(isOpen ? null : y.idx)} aria-expanded={isOpen} className="flex min-h-11 flex-1 items-center gap-2 text-left">
                    <Icon name={isOpen ? 'ph ph-caret-up' : 'ph ph-caret-down'} className="text-[12px] text-neutral-500" />
                    <span className="text-[13px] font-medium text-neutral-100">
                      Year {i + 1} · {y.year}
                    </span>
                  </button>
                  <span className="rounded-full border px-2 py-[3px] text-[10.5px] font-medium" style={{ borderColor: y.drafts ? 'var(--color-neutral-800)' : 'var(--color-accent-600)', color: y.drafts ? 'var(--color-neutral-400)' : 'var(--color-accent-200)' }}>
                    {y.drafts ? y.drafts + (y.drafts === 1 ? ' draft' : ' drafts') : 'Confirmed'}
                  </span>
                  {y.drafts ? (
                    <Btn variant="secondary" className="px-3 text-[12px]" onClick={() => confirmYear(y.idx, y.year)}>
                      Confirm {y.year}
                    </Btn>
                  ) : null}
                </div>
                {isOpen ? (
                  <div className="flex flex-col border-t border-divider">
                    {y.rows.map((s) => (
                      <div key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-[8px]">
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-medium text-neutral-100">{s.name}</div>
                          <div className="mt-[2px] text-[11px] text-neutral-500">
                            {String(s.answers.weeks)} weeks · starts {day(String(s.answers.start))} · {s.active ? 'Running now' : s.plan!.draft ? 'Draft' : 'Ready'}
                          </div>
                        </div>
                        <span className="rounded-full border px-2 py-[3px] text-[10.5px] font-medium" style={{ borderColor: s.plan!.scored ? 'var(--color-accent-600)' : 'var(--color-neutral-800)', color: s.plan!.scored ? 'var(--color-accent-200)' : 'var(--color-neutral-500)' }}>
                          {s.plan!.scored ? 'Scored' : 'No scoring'}
                        </span>
                        <Btn variant="ghost" className="px-3 text-[12px]" onClick={() => review(s)}>
                          Review the answers
                        </Btn>
                        {!s.active && !s.plan!.draft ? (
                          <Btn variant="ghost" className="px-3 text-[12px]" onClick={() => makeLive(s)}>
                            Make live
                          </Btn>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </Section>
  );
}

function Interview({ draft, setDraft, onSave }: { draft: Draft; setDraft: (d: Draft | null) => void; onSave: (a: SeasonAnswers, live: boolean) => void }) {
  const cfg = useApp((s) => s.data.config);
  const today = isoDay(new Date());
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const answer = (id: string, v: SeasonAnswer | undefined) => {
    const answers = { ...draft.answers };
    if (v === undefined) delete answers[id];
    else answers[id] = v;
    set({ answers });
  };
  const go = (step: number | 'review') => set({ step });
  const after = (): number | 'review' => (draft.returnToReview || draft.step === SEASON_QUESTIONS.length - 1 ? 'review' : (draft.step as number) + 1);
  const next = () => go(after());
  const skip = (id: string) => {
    const answers = { ...draft.answers };
    delete answers[id];
    set({ answers, step: after() });
  };

  const rail = (
    <div className="mb-3 flex flex-wrap gap-[6px]">
      {SEASON_GROUPS.map((g) => {
        const qs = SEASON_QUESTIONS.filter((q) => q.group === g.id);
        const answered = qs.filter((q) => seasonAnswered(draft.answers, q.id)).length;
        const here = draft.step !== 'review' && SEASON_QUESTIONS[draft.step as number].group === g.id;
        return (
          <button
            key={g.id}
            onClick={() => go(SEASON_QUESTIONS.indexOf(qs[0]))}
            className="rounded-full border px-3 py-[6px] text-[11.5px]"
            style={{ borderColor: here ? 'var(--color-accent-500)' : 'var(--color-neutral-800)', color: here ? 'var(--color-accent-100)' : 'var(--color-neutral-400)' }}
          >
            {g.label} <span className="text-neutral-500">{answered + '/' + qs.length}</span>
          </button>
        );
      })}
      <button onClick={() => go('review')} className="rounded-full border px-3 py-[6px] text-[11.5px]" style={{ borderColor: draft.step === 'review' ? 'var(--color-accent-500)' : 'var(--color-neutral-800)', color: draft.step === 'review' ? 'var(--color-accent-100)' : 'var(--color-neutral-400)' }}>
        Review
      </button>
    </div>
  );

  if (draft.step === 'review') {
    const implied = seasonSettings(draft.answers, cfg, today);
    return (
      <Section
        title={'Review · ' + String(answerOf(draft.answers, SEASON_QUESTIONS[0], today))}
        sub="The whole season in one place. Rows marked default are answers you skipped. Rows marked “set in” are recorded here and finished on that screen."
        right={
          <Btn variant="ghost" className="px-3" onClick={() => setDraft(null)}>
            Close
          </Btn>
        }
      >
        {rail}
        <div className="rounded-md bg-neutral-900 px-3 py-[10px] text-[12px] leading-[1.6] text-neutral-300 text-pretty">
          <span className="text-neutral-500">Making it live sets: </span>
          {implied.meetingDates!.length} meeting nights from {answerLabel(SEASON_QUESTIONS.find((q) => q.id === 'start')!, implied.meetingDates![0])} · {implied.weekGrowthPct}% growth a week · verse board {implied.verseBoard ? 'on' : 'off'} · parent board {implied.parentShare!.standings ? 'on' : 'off'} · {implied.gameSetup!.gameWeeks === null ? 'a game every week' : implied.gameSetup!.gameWeeks.length ? 'games on chosen weeks' : 'no games'}. {CARRY_LINE[squadCarry(seasonAnswered(draft.answers, 'assign') ? String(draft.answers.assign) : undefined, cfg.draft?.dynasty)]}
        </div>
        {SEASON_GROUPS.map((g) => (
          <div key={g.id} className="flex flex-col">
            <div className="sr-label mb-1">{g.label}</div>
            {SEASON_QUESTIONS.filter((q) => q.group === g.id).map((q) => {
              const v = answerOf(draft.answers, q, today);
              const skipped = !seasonAnswered(draft.answers, q.id);
              return (
                <div key={q.id} className="flex items-start gap-3 border-t border-divider py-[9px]">
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] text-neutral-500">{q.q}</div>
                    <div className="mt-[2px] text-[13px] text-neutral-100">{answerLabel(q, v)}</div>
                    <div className="mt-1 flex gap-2">
                      {skipped ? <span className="rounded-full border border-neutral-700 px-2 py-[2px] text-[10px] uppercase tracking-[.08em] text-neutral-400">default</span> : null}
                      {q.setIn ? (
                        <Link href={q.setIn.href} className="rounded-full border border-neutral-800 px-2 py-[2px] text-[10px] text-neutral-500">
                          set in {q.setIn.label}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <Btn variant="ghost" className="px-3 text-[12px]" onClick={() => set({ step: SEASON_QUESTIONS.indexOf(q), returnToReview: true })}>
                    Change
                  </Btn>
                </div>
              );
            })}
          </div>
        ))}
        <div className="flex flex-wrap gap-2 border-t border-divider pt-3">
          <Btn onClick={() => onSave(draft.answers, true)}>Save and make it live</Btn>
          <Btn variant="secondary" onClick={() => onSave(draft.answers, false)}>
            Save for later
          </Btn>
        </div>
      </Section>
    );
  }

  const i = draft.step as number;
  const q = SEASON_QUESTIONS[i];
  const raw = draft.answers[q.id];
  const v = answerOf(draft.answers, q, today);
  return (
    <Section title={'Question ' + (i + 1) + ' of ' + SEASON_QUESTIONS.length} sub={SEASON_GROUPS.find((g) => g.id === q.group)?.label} right={<Btn variant="ghost" className="px-3" onClick={() => setDraft(null)}>Close</Btn>}>
      {rail}
      <div className="text-[20px] font-medium leading-[1.25] text-neutral-100 text-pretty">{q.q}</div>
      {q.help ? <div className="-mt-1 text-[12.5px] leading-[1.5] text-neutral-500 text-pretty">{q.help}</div> : null}

      {q.kind === 'choice' ? (
        <div className="flex flex-col gap-2">
          {q.options!.map((o) => {
            const on = raw === o.value;
            return (
              <button
                key={String(o.value)}
                onClick={() => answer(q.id, o.value)}
                aria-pressed={on}
                className="flex min-h-11 flex-col items-start justify-center rounded-md border px-3 py-[9px] text-left"
                style={{ borderColor: on ? 'var(--color-accent-500)' : 'var(--color-neutral-800)', background: on ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent' }}
              >
                <span className="text-[13px] font-medium text-neutral-100">{o.label}</span>
                {o.note ? <span className="mt-[2px] text-[11.5px] text-neutral-500">{o.note}</span> : null}
              </button>
            );
          })}
        </div>
      ) : q.kind === 'multi' ? (
        <div className="flex flex-wrap gap-2">
          {q.options!.map((o) => {
            const cur = (Array.isArray(raw) ? raw : []) as string[];
            const on = cur.includes(String(o.value));
            return (
              <button
                key={String(o.value)}
                onClick={() => answer(q.id, on ? cur.filter((x) => x !== o.value) : [...cur, String(o.value)])}
                aria-pressed={on}
                className="min-h-10 rounded-full border px-3 text-[12.5px]"
                style={{ borderColor: on ? 'var(--color-accent-500)' : 'var(--color-neutral-800)', color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-300)', background: on ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent' }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      ) : (
        <input
          className="input max-w-[360px]"
          type={q.kind === 'number' ? 'number' : q.kind === 'date' ? 'date' : 'text'}
          min={q.min}
          max={q.max}
          placeholder={q.placeholder ?? (q.kind === 'date' ? '' : String(v))}
          value={raw === undefined ? '' : String(raw)}
          onChange={(e) => answer(q.id, e.target.value === '' ? undefined : q.kind === 'number' ? Number(e.target.value) : e.target.value)}
          aria-label={q.q}
        />
      )}
      <div className="text-[11.5px] text-neutral-500">{seasonAnswered(draft.answers, q.id) ? 'Answered.' : 'Skipping uses: ' + answerLabel(q, v)}</div>

      <div className="flex flex-wrap gap-2 border-t border-divider pt-3">
        <Btn variant="ghost" className="px-3" disabled={i === 0} onClick={() => go(i - 1)}>
          Back
        </Btn>
        <Btn variant="secondary" className="px-3" onClick={() => skip(q.id)}>
          Skip
        </Btn>
        <Btn className="px-4" onClick={next}>
          {draft.returnToReview ? 'Back to the review' : i === SEASON_QUESTIONS.length - 1 ? 'Review the season' : 'Next'}
        </Btn>
      </div>
    </Section>
  );
}
