'use client';
/* RACES = squad pushes + the individual leaderboard, one screen with a
   switch. They are the same question asked two ways. The "Go deeper" track
   lives here too: a student's daily response, reviewed by a coach, pays the
   squad and credits the week's challenges — with no second entry. */
import { useMemo, useState } from 'react';
import { Sheet } from '@/components/sheet';
import { Avatar, Btn, Icon, Screen, ScreenHeader, Switch2, initialsOf } from '@/components/ui';
import { ago } from '@/lib/dates';
import { creditChallenges } from '@/lib/feeds';
import { wasHeld } from '@/lib/held';
import { canApprove, canHuddle } from '@/lib/permissions';
import { fmt, studentRanks } from '@/lib/scoring';
import { myTeamId, teamOf } from '@/lib/selectors';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';

export function RacesScreen() {
  const [tab, setTab] = useState<'teams' | 'mvp'>('teams');
  return (
    <Screen label={tab === 'teams' ? 'Races · squad pushes' : 'Races · individuals'}>
      <ScreenHeader title="Races" />
      <Switch2
        label="Show"
        value={tab}
        onChange={setTab}
        options={[
          { id: 'teams', label: 'Squad pushes' },
          { id: 'mvp', label: 'Individuals' }
        ]}
      />
      {tab === 'teams' ? <SquadPushes /> : <Individuals />}
    </Screen>
  );
}

function SquadPushes() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const coachTeam = useApp((s) => s.coachTeam);
  const api = useAppApi();
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState('');
  const group = d.smallGroups.find((g) => g.deepDive?.days.length && g.weekNumber === d.config.weekNumber) ?? d.smallGroups.find((g) => g.deepDive?.days.length);
  const me = m.studentName ?? m.displayName;
  const subFor = (i: number) => (group ? d.deepSubs.find((x) => x.groupId === group.id && x.dayIdx === i && x.student === me) : undefined);
  const myTeam = myTeamId(m, d, coachTeam);
  const review = d.deepSubs.filter((x) => x.status === 'pending' && (canApprove(m.persona) || x.team === myTeam));

  const decide = (id: string, ok: boolean) => {
    const sub = d.deepSubs.find((x) => x.id === id);
    if (!sub) return;
    const pays = ok && !sub.awarded;
    api().mutate((x) => {
      const r = x.deepSubs.find((y) => y.id === id);
      if (r) {
        r.status = ok ? 'approved' : 'sentBack';
        r.awarded = r.awarded || pays;
        r.decidedBy = m.displayName;
      }
      if (pays) {
        const credit = creditChallenges(x.challenges, x.challengeCredit, sub.student, sub.team);
        if (credit) x.challengeCredit = credit;
      }
    });
    if (ok && pays) {
      /* An approved answer is an award like any other — through award(). */
      api().award({ team: sub.team, cat: 'bible', amount: sub.points, why: sub.student + ' · went deeper on ' + sub.ref, student: sub.student });
      api().logActivity('Approved go-deeper response from ' + sub.student + ' — ' + fmt(sub.points) + ' to ' + teamOf(d, sub.team).name);
      api().sayPosted('Approved — ' + fmt(sub.points) + ' going-deeper points to ' + teamOf(d, sub.team).name + '.', 'Approved — ' + fmt(sub.points) + ' going-deeper points held until you have signal.');
    } else if (ok) {
      api().say('Approved — this day was already paid, so no new points.');
    } else {
      api().logActivity('Sent back go-deeper response from ' + sub.student);
      api().say('Sent back to ' + sub.student + ' to go deeper.');
    }
  };

  const submit = () => {
    if (!group || openDay == null) return;
    const text = draft.trim();
    if (text.length < 25) {
      api().say('Write a little more — a couple of real sentences about what you read.');
      return;
    }
    const day = group.deepDive!.days[openDay];
    const existing = subFor(openDay);
    api().mutate((x) => {
      const rec = {
        id: existing?.id ?? uid(), groupId: group.id, dayIdx: openDay, day: day.day, ref: day.ref, prompt: day.prompt,
        student: me, team: myTeam, text, at: Date.now(), status: 'pending' as const, points: 150, awarded: existing?.awarded ?? false
      };
      const i = x.deepSubs.findIndex((y) => y.id === rec.id);
      if (i >= 0) x.deepSubs[i] = rec;
      else x.deepSubs.push(rec);
    });
    api().logActivity('Go-deeper response submitted by ' + me + ' — ' + day.ref);
    setOpenDay(null);
    api().say('Sent to your coach for going-deeper points.');
  };

  const openSub = openDay != null ? subFor(openDay) : undefined;
  const day = openDay != null && group ? group.deepDive!.days[openDay] : null;

  return (
    <>
      {group?.deepDive ? (
        <div className="flex flex-col gap-[10px] rounded-lg border border-accent-700 px-[15px] py-[14px]" style={{ background: 'color-mix(in srgb, var(--color-accent) 7%, transparent)' }}>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-accent-700 px-2 py-1 text-[9.5px] font-semibold uppercase leading-none tracking-[.1em] text-accent-300">Go deeper</span>
            <span className="text-[11px] leading-none text-neutral-500">150 pts a day</span>
            <span className="ml-auto text-[11px] leading-none text-accent-300">
              {group.deepDive.days.filter((_, i) => subFor(i)?.status === 'approved').length} of {group.deepDive.days.length} approved
            </span>
          </div>
          <div className="text-[14.5px] font-medium leading-[1.3] text-neutral-100">{group.deepDive.title}</div>
          <div className="text-[12px] leading-[1.5] text-neutral-500 text-pretty">{group.deepDive.studentAsk}</div>
          <div className="border-l-2 border-accent-500 pl-[10px]">
            <div className="text-[9.5px] font-semibold uppercase leading-none tracking-[.08em] text-accent-300">Memory verse · {group.deepDive.verseRef}</div>
            <div className="mt-1 text-[11.5px] leading-[1.5] text-neutral-300 text-pretty">{group.deepDive.verseText}</div>
          </div>
          <div className="flex flex-col gap-[6px]">
            {group.deepDive.days.map((dd, i) => {
              const sub = subFor(i);
              const st = sub?.status ?? 'none';
              return (
                <button
                  key={i}
                  onClick={() => {
                    setOpenDay(i);
                    setDraft(sub?.text ?? '');
                    setStep(sub ? 2 : 0);
                  }}
                  className="flex min-h-[46px] items-center gap-[10px] rounded-md border px-[11px] py-[10px] text-left"
                  style={{ borderColor: st === 'approved' ? 'var(--color-accent-600)' : 'var(--color-neutral-800)', background: st === 'approved' ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'var(--color-neutral-900)' }}
                >
                  <Icon
                    name={st === 'approved' ? 'ph-fill ph-check-circle' : st === 'pending' ? 'ph ph-hourglass-medium' : st === 'sentBack' ? 'ph ph-arrow-u-up-left' : 'ph ph-book-open-text'}
                    className="flex-none text-[16px]"
                    style={{ color: st === 'approved' ? 'var(--color-accent-300)' : st === 'none' ? 'var(--color-neutral-500)' : 'var(--color-accent-200)' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium leading-[1.2]" style={{ color: st === 'none' ? 'var(--color-neutral-200)' : 'var(--color-neutral-100)' }}>
                      {dd.day} · {dd.ref}
                    </div>
                    <div className="mt-[3px] text-[10.5px] leading-[1.4] text-neutral-500">
                      {st === 'approved' ? 'Approved · +' + fmt(sub!.points) + ' pts' : st === 'pending' ? 'Waiting on your coach' : st === 'sentBack' ? 'Coach sent it back — go deeper' : 'Read, focus, respond'}
                    </div>
                  </div>
                  <Icon name="ph ph-caret-right" className="flex-none text-[13px] text-neutral-600" />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {canHuddle(m.persona) && review.length ? (
        <div className="flex flex-col gap-[9px]">
          <div className="flex items-center gap-2">
            <div className="flex-1 text-[9.5px] font-semibold uppercase leading-none tracking-[.1em] text-neutral-500">Going deeper · responses to review</div>
            <span className="text-[10.5px] leading-none text-accent-300">{review.length} waiting</span>
          </div>
          {review.map((r) => (
            <div key={r.id} className="sr-card flex flex-col gap-2 px-[14px] py-[13px]">
              <div className="flex items-center gap-2">
                <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: teamOf(d, r.team).color }} />
                <div className="flex-1 text-[13px] font-medium leading-[1.2] text-neutral-100">{r.student}</div>
                <span className="text-[10.5px] leading-none text-neutral-500">{ago(r.at)}</span>
              </div>
              <div className="text-[9.5px] font-semibold uppercase leading-none tracking-[.08em] text-accent-300">
                {r.day} · {r.ref}
              </div>
              <div className="text-[11px] leading-[1.5] text-neutral-500 text-pretty">{r.prompt}</div>
              <div className="border-l-2 border-neutral-700 pl-[10px] text-[12px] leading-[1.6] text-neutral-300 text-pretty">{r.text}</div>
              <div className="flex flex-wrap gap-2">
                <Btn className="px-[13px]" onClick={() => decide(r.id, true)}>
                  Approve · {fmt(r.points)} pts
                </Btn>
                <Btn variant="ghost" className="px-[13px]" onClick={() => decide(r.id, false)}>
                  Send back
                </Btn>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!d.challenges.length ? (
        <div className="flex flex-col items-start gap-[9px] rounded-lg border border-dashed border-neutral-700 px-4 py-5">
          <Icon name="ph ph-target" className="text-[20px] text-neutral-500" />
          <div className="text-[12px] leading-[1.5] text-neutral-500 text-pretty">Nothing running this week. Challenges are set up in the web dashboard and can be scheduled to any week of the season.</div>
        </div>
      ) : null}
      {d.challenges.map((c) => {
        const rec = d.tonight.pushed[c.id];
        const pushed = !!rec;
        const credit = d.challengeCredit[c.id]?.length ?? 0;
        const status = pushed ? (wasHeld(rec) ? 'Held until you have signal' : 'Pushed to ledger') : c.status + (credit ? ' · ' + credit + ' credited from small group' : '');
        const action = c.done ? (pushed ? (wasHeld(rec) ? 'Points held · sending when you reconnect' : 'Points posted ✓') : 'Push ' + c.pointsLabel + ' to the ledger') : 'View progress';
        const hot = c.done && !pushed;
        return (
          <div key={c.id} className="sr-card px-[15px] py-[14px]">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-accent-700 px-2 py-1 text-[9.5px] font-semibold uppercase leading-none tracking-[.1em] text-accent-300">{c.kind}</span>
              <span className="text-[11px] leading-none text-neutral-500">{c.pointsLabel}</span>
              <span className="ml-auto text-[11px] leading-none" style={{ color: pushed || c.done ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }}>
                {status}
              </span>
            </div>
            <div className="mt-[10px] text-[14.5px] font-medium leading-[1.3] text-neutral-100">{c.title}</div>
            <div className="mt-[5px] text-[12px] leading-[1.5] text-neutral-500 text-pretty">{c.body}</div>
            <button
              onClick={() => {
                if (!c.done) {
                  api().say('Coaches confirm the rest from the roster screen.');
                  return;
                }
                if (pushed) {
                  api().say(wasHeld(rec) ? 'Already recorded — held until you have signal.' : 'Already in the ledger — see the audit log.');
                  return;
                }
                if (!c.team || !c.cat || !c.amount) return;
                const flag = api().award({ team: c.team, cat: c.cat, amount: c.amount, why: c.title, by: m.displayName + ' · challenge' });
                if (!flag) return;
                api().mutate((x) => {
                  x.tonight.pushed[c.id] = flag === 'held' ? 'held' : 'posted';
                });
                api().sayPosted(fmt(c.amount) + ' posted to ' + teamOf(d, c.team).name + ', fully audited.', fmt(c.amount) + ' for ' + teamOf(d, c.team).name + ' held until you have signal.');
              }}
              className="mt-3 min-h-11 w-full rounded-md border text-[12.5px] font-semibold leading-none"
              style={{
                borderColor: hot ? 'var(--color-accent-500)' : 'var(--color-neutral-800)',
                background: hot ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)' : 'transparent',
                color: hot ? 'var(--color-accent-100)' : 'var(--color-neutral-400)'
              }}
            >
              {action}
            </button>
          </div>
        );
      })}

      <Sheet open={openDay != null && !!day} onClose={() => setOpenDay(null)} label="Go deeper" z={92} maxH="90%">
        {day ? (
          <>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-[9.5px] font-semibold uppercase leading-none tracking-[.1em] text-accent-300">{day.day} · going deeper</div>
              <button aria-label="Close day detail" onClick={() => setOpenDay(null)} className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-neutral-800 text-neutral-500">
                <Icon name="ph ph-x" className="text-[13px]" />
              </button>
            </div>
            <div className="flex gap-[6px]">
              {['Read', 'Focus', 'Respond'].map((label, i) => (
                <button
                  key={label}
                  onClick={() => setStep(i)}
                  className="min-h-11 flex-1 rounded-md border text-[10px] font-semibold uppercase leading-none tracking-[.08em]"
                  style={{ borderColor: step === i ? 'var(--color-accent-500)' : 'var(--color-neutral-800)', background: step === i ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent', color: step === i ? 'var(--color-accent-200)' : 'var(--color-neutral-500)' }}
                >
                  {label}
                </button>
              ))}
            </div>
            {step === 0 ? (
              <>
                <div className="text-[22px] font-medium leading-[1.2] text-neutral-100">{day.ref}</div>
                <div className="text-[12.5px] leading-[1.6] text-neutral-400 text-pretty">Read the whole passage before you write anything — out loud if you’re somewhere you can. Slow enough that you notice one thing you’ve never noticed.</div>
                {group?.deepDive?.verseRef === day.ref ? <div className="border-l-2 border-accent-500 pl-[11px] text-[12.5px] leading-[1.65] text-neutral-300 text-pretty">{group.deepDive.verseText}</div> : null}
                <Btn className="min-h-[46px] justify-center" onClick={() => setStep(1)}>
                  I read it
                </Btn>
              </>
            ) : step === 1 ? (
              <>
                <div className="text-[9.5px] font-semibold uppercase leading-none tracking-[.1em] text-neutral-500">Focus</div>
                <div className="text-[17px] font-medium leading-[1.4] text-neutral-100 text-pretty">{day.prompt}</div>
                <div className="text-[12px] leading-[1.6] text-neutral-500 text-pretty">Sit with it for a minute before you answer. Talk to God about it in your own words, then write what came up.</div>
                <Btn className="min-h-[46px] justify-center" onClick={() => setStep(2)}>
                  Write my response
                </Btn>
              </>
            ) : (
              <>
                <div className="text-[9.5px] font-semibold uppercase leading-none tracking-[.1em] text-neutral-500">Respond</div>
                <div className="text-[11.5px] leading-[1.5] text-neutral-500 text-pretty">{day.prompt}</div>
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="input !min-h-[120px]" placeholder="What did the passage actually say, and what are you going to do about it?" aria-label="Your response" />
                <div className="text-[10.5px] leading-[1.4] text-neutral-500">{draft.trim().length < 25 ? 'A couple of real sentences at least — your coach reads these.' : draft.trim().length + ' characters · ready to send'}</div>
                {openSub ? (
                  <div className="flex items-start gap-2 rounded-md px-[11px] py-[10px]" style={{ background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)' }}>
                    <Icon name={openSub.status === 'approved' ? 'ph-fill ph-check-circle' : openSub.status === 'sentBack' ? 'ph ph-arrow-u-up-left' : 'ph ph-hourglass-medium'} className="mt-[1px] flex-none text-[14px] text-accent-300" />
                    <div className="text-[11px] leading-[1.5] text-accent-100 text-pretty">
                      {openSub.status === 'approved'
                        ? (openSub.decidedBy ?? 'Your coach') + ' approved this — ' + fmt(openSub.points) + ' going-deeper points went to ' + teamOf(d, openSub.team).name + '. Editing it won’t pay twice.'
                        : openSub.status === 'sentBack'
                          ? (openSub.decidedBy ?? 'Your coach') + ' sent this back. Go further into the passage and send it again.'
                          : 'Sent — waiting on a coach to read it.'}
                    </div>
                  </div>
                ) : null}
                <Btn className="min-h-12 justify-center" onClick={submit}>
                  {openSub ? (openSub.status === 'sentBack' ? 'Send it back to my coach' : openSub.status === 'approved' ? 'Update my response' : 'Resend to my coach') : 'Send to my coach'}
                </Btn>
              </>
            )}
          </>
        ) : null}
      </Sheet>
    </>
  );
}

function Individuals() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const [filter, setFilter] = useState('');
  const ranked = useMemo(() => studentRanks(d.roster.filter((r) => !filter || r.team === filter), d.ledger, d.studentSeedPoints), [d.roster, d.ledger, d.studentSeedPoints, filter]);
  const pool = d.roster.filter((r) => !filter || r.team === filter).length;
  return (
    <>
      <div className="text-[11.5px] leading-[1.5] text-neutral-500 text-pretty">Individual points across every team — attendance, Bible practice, friends brought, spirit wear and game play, all counted per student.</div>
      <div className="flex gap-[6px] overflow-x-auto pb-[2px]">
        {[{ id: '', name: 'All teams', color: 'var(--color-accent-400)' }, ...d.teams].map((t) => {
          const on = filter === t.id;
          return (
            <button
              key={t.id || 'all'}
              onClick={() => setFilter(t.id)}
              aria-pressed={on}
              className="flex min-h-11 flex-none items-center gap-[6px] rounded-full border px-[11px] text-[11.5px] font-medium leading-none"
              style={{ borderColor: on ? 'var(--color-accent-600)' : 'var(--color-neutral-800)', background: on ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)' : 'transparent', color: on ? 'var(--color-accent-200)' : 'var(--color-neutral-400)' }}
            >
              <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: t.color }} />
              {t.name}
            </button>
          );
        })}
      </div>
      <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Top 20 of {pool} students</div>
      <div className="flex flex-col gap-[7px]">
        {ranked.slice(0, 20).map((x, i) => {
          const r = d.roster.find((y) => y.name === x.name)!;
          const t = teamOf(d, r.team);
          const b = d.studentBadges.find((y) => y.name === x.name);
          const me = x.name === m.studentName;
          return (
            <div key={x.name} className="flex items-center gap-[11px] rounded-lg px-[13px] py-[11px]" style={{ background: me ? 'color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))' : 'var(--color-surface)', boxShadow: me ? 'inset 0 0 0 1px var(--color-accent-600)' : 'var(--shadow-sm)' }}>
              <div className="tabular w-[18px] flex-none text-[12px] font-semibold leading-none text-neutral-500">{i + 1}</div>
              <Avatar initials={initialsOf(x.name)} color={t.color} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-[5px]">
                  <div className="truncate text-[13px] font-medium leading-[1.2] text-neutral-100">{x.name}</div>
                  {i < 3 ? <Icon name={i === 0 ? 'ph-fill ph-medal' : i === 1 ? 'ph-fill ph-medal-military' : 'ph ph-medal'} className="flex-none text-[13px] text-accent-300" /> : null}
                </div>
                <div className="mt-[3px] text-[10.5px] leading-[1.3] text-neutral-500">
                  {t.name} · Grade {r.grade}
                  {r.captain ? ' · Captain' : ''}
                </div>
                {b ? <div className="mt-[2px] text-[10px] leading-[1.3] text-neutral-500">{b.attendStreak} wk attendance · {Math.ceil(b.bibleStreak / 7)} wk Bible</div> : null}
              </div>
              <div className="tabular flex-none text-[14px] font-semibold leading-none text-neutral-200">{fmt(x.total)}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
