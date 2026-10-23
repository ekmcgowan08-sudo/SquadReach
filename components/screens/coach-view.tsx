'use client';
/* COACH VIEW — one screen for a volunteer: pick a squad, award category
   points, mark who is here, post attendance, run per-student check-in
   questions, add a new student. Marking who is here IS the scoring step;
   a second submit is where volunteers drop off. ROSTER_EDIT_ROLES. */
import { useMemo, useState } from 'react';
import { StudentSheet } from '@/components/dashboard/student-sheet';
import { Sheet } from '@/components/sheet';
import { Btn, Icon, Screen, ScreenHeader } from '@/components/ui';
import { autoApproves, canSwitchTeamView } from '@/lib/permissions';
import { CHECKIN_PRESENT_PTS, CHECKIN_QUESTIONS, checkinQuestionPts, fmt, standings } from '@/lib/scoring';
import { ago } from '@/lib/dates';
import { catOf, teamOf } from '@/lib/selectors';
import { postCoachCheckin } from '@/lib/store/actions';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';

export function CoachViewScreen() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const coachTeam = useApp((s) => s.coachTeam);
  const api = useAppApi();
  const [cat, setCat] = useState('general');
  const [mult, setMult] = useState(1);
  const [tipSeen, setTipSeen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [checkin, setCheckin] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, boolean>>({});
  const [visitors, setVisitors] = useState('');
  const [logFor, setLogFor] = useState<string | null>(null);

  const teamId = canSwitchTeamView(m.persona) ? coachTeam || d.teams[0]?.id : m.teamId ?? coachTeam;
  const team = teamOf(d, teamId);
  const rows = useMemo(() => standings(d.teams, d.cats, d.ledger), [d.teams, d.cats, d.ledger]);
  const row = rows.find((r) => r.id === teamId);
  const roster = d.roster.filter((r) => r.team === teamId);
  const here = roster.filter((r) => d.tonight.presence[r.name]).length;
  const base = api().base();
  const live = autoApproves(m.persona);
  const payCats = d.cats.filter((c) => c.id === 'general' || d.config.checkinAutoCats[c.id]);
  const mySubmitted = d.ledger.filter((e) => e.status === 'pending' && e.by.startsWith(m.displayName)).slice(0, 6);

  const openCheckin = (name: string) => {
    const det = d.tonight.checkinDetail[name];
    setPicks(det?.picks ?? {});
    setVisitors(det?.visitors ?? '');
    setCheckin(name);
  };

  const submitPoints = () => {
    const amount = Math.round(base * mult);
    const c = catOf(d, cat);
    const flag = api().award({ team: teamId, cat, amount, why: c.label + ' · sent from coach view' });
    if (!flag) return;
    api().sayPosted(
      live ? '+' + fmt(amount) + ' ' + c.label + ' → ' + team.name + '. Posted live.' : 'Sent to the youth pastor for approval.',
      '+' + fmt(amount) + ' ' + c.label + ' → ' + team.name + '. Held until you have signal.'
    );
  };

  const addStudent = () => {
    const name = newName.trim();
    if (!name) {
      api().say('Type the student’s name first.');
      return;
    }
    if (d.roster.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      api().say(name + ' is already on a roster.');
      return;
    }
    const student = { id: uid(), name, team: teamId, grade: newGrade.trim() || '—', newInDb: true, guest: true };
    api().mutate((x) => {
      x.roster.push(student);
    });
    api().emit({ kind: 'student', student });
    api().logActivity('Added ' + name + ' to ' + team.name + ' from the floor');
    setAddOpen(false);
    setNewName('');
    setNewGrade('');
    openCheckin(name);
  };

  return (
    <Screen label="Coach view" gap={13}>
      <ScreenHeader title="Coach view" />
      {canSwitchTeamView(m.persona) ? (
        <div className="flex flex-col gap-[6px]">
          <div className="text-[11px] leading-[1.4] text-neutral-500">Coaching — tap any squad. The roster, attendance and points below follow your pick.</div>
          <div className="flex gap-[6px] overflow-x-auto pb-[2px]">
            {d.teams.map((t) => {
              const on = t.id === teamId;
              const r = d.roster.filter((x) => x.team === t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    api().setCoachTeam(t.id);
                    api().say('Coaching ' + t.name + ' — roster, attendance and points follow.');
                  }}
                  aria-pressed={on}
                  className="flex min-h-11 flex-none items-center gap-[6px] rounded-full border px-3 text-[12px] font-medium leading-none"
                  style={{ borderColor: on ? t.color : 'var(--color-neutral-800)', background: on ? 'color-mix(in srgb, ' + t.color + ' 16%, transparent)' : 'transparent', color: on ? 'var(--color-neutral-100)' : 'var(--color-neutral-400)' }}
                >
                  <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: t.color }} />
                  {t.name}
                  <span className="tabular text-[10.5px] font-normal leading-none text-neutral-500">
                    {r.filter((x) => d.tonight.presence[x.name]).length}/{r.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {!tipSeen ? (
        <div className="flex items-start gap-[10px] rounded-lg border border-accent-700 px-[14px] py-[13px]" style={{ background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)' }}>
          <Icon name="ph ph-lightbulb" className="mt-[1px] flex-none text-[16px] text-accent-300" />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium leading-[1.2] text-neutral-100">First time here</div>
            <div className="mt-[5px] text-[11.5px] leading-[1.5] text-neutral-400 text-pretty">
              Pick what happened, pick how big it was, then send it. {live ? 'Your entries post straight to the board.' : 'The youth pastor approves it before the board moves.'} Tap a student to log something just for them.
            </div>
          </div>
          <button aria-label="Dismiss coach tip" onClick={() => setTipSeen(true)} className="-mr-2 -mt-[10px] flex h-11 w-11 flex-none items-center justify-center text-neutral-500">
            <Icon name="ph ph-x" className="text-[14px]" />
          </button>
        </div>
      ) : null}

      <div className="sr-card flex items-center gap-3 p-[14px]">
        <div className="h-[38px] w-[10px] flex-none rounded-[3px]" style={{ background: team.color }} />
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-medium leading-[1.2] text-neutral-100">{team.name}</div>
          <div className="mt-1 text-[11px] leading-[1.3] text-neutral-500">{row ? (row.rank === 1 ? 'Leading the league' : '#' + row.rank + ' · ' + fmt(row.behind) + ' back') : ''}</div>
        </div>
        <div className="tabular flex-none text-[20px] font-semibold leading-none text-neutral-100">{fmt(row?.total ?? 0)}</div>
      </div>

      <div className="sr-card flex flex-col gap-[10px] px-[14px] py-[13px]">
        <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Award points</div>
        <div className="flex flex-wrap gap-[6px]">
          {d.cats.map((c) => {
            const on = cat === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                aria-pressed={on}
                className="flex min-h-11 items-center gap-[6px] rounded-full border px-[11px] text-[11.5px] font-medium leading-none"
                style={{ borderColor: on ? c.color : 'var(--color-neutral-800)', background: on ? 'color-mix(in srgb, ' + c.color + ' 16%, transparent)' : 'transparent', color: on ? 'var(--color-neutral-100)' : 'var(--color-neutral-400)' }}
              >
                <Icon name={c.icon} className="text-[13px]" style={{ color: on ? c.color : 'var(--color-neutral-600)' }} />
                {c.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-[7px]">
          {[
            { m: 0.5, label: 'Half' },
            { m: 1, label: 'Base' },
            { m: 2, label: 'Double' }
          ].map((x) => {
            const on = mult === x.m;
            return (
              <button
                key={x.m}
                onClick={() => setMult(x.m)}
                aria-pressed={on}
                className="flex min-h-12 flex-1 flex-col items-center justify-center gap-[3px] rounded-md border"
                style={{ borderColor: on ? 'var(--color-accent-600)' : 'var(--color-neutral-800)', background: on ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent', color: on ? 'var(--color-accent-200)' : 'var(--color-neutral-400)' }}
              >
                <span className="text-[11.5px] font-medium leading-none">{x.label}</span>
                <span className="tabular text-[13px] font-semibold leading-none">{fmt(Math.round(base * x.m))}</span>
              </button>
            );
          })}
        </div>
        <Btn className="min-h-12 justify-center" onClick={submitPoints}>
          {live ? 'Post to the board' : 'Send for approval'}
        </Btn>
        <div className="text-[10.5px] leading-[1.4] text-neutral-500">
          {live ? 'You approve your own entries — this posts live.' : 'The youth pastor sees it in the approval queue before it hits the board.'}
        </div>
        {mySubmitted.length && !live ? (
          <div className="flex flex-col gap-[5px] border-t border-divider pt-[9px]">
            {mySubmitted.map((x) => (
              <div key={x.id} className="flex items-center gap-2">
                <Icon name="ph ph-clock-countdown" className="flex-none text-[12px] text-neutral-500" />
                <span className="flex-1 text-[11.5px] leading-none text-neutral-400">
                  +{fmt(x.amount)} {catOf(d, x.cat).label}
                </span>
                <span className="text-[10px] leading-none text-neutral-500">{ago(x.at)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-baseline gap-2">
        <div className="flex-1 text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">My roster</div>
        <div className="text-[10.5px] leading-none text-neutral-500">
          {here} of {roster.length} here tonight
        </div>
      </div>
      <div className="-mt-[6px] text-[11px] leading-[1.5] text-neutral-500 text-pretty">Tap a name to run check-in questions. Points post the moment you finish.</div>
      <div className="flex gap-[6px]">
        <Btn variant="secondary" className="flex-1 justify-center" onClick={() => api().markAllPresent(teamId, true)}>
          <Icon name="ph ph-check-square-offset" className="text-[14px]" />
          Everyone’s here
        </Btn>
        <Btn className="flex-1 justify-center" onClick={() => api().postAttendance(teamId)}>
          Post attendance
        </Btn>
      </div>
      <div className="-mt-1 text-[10.5px] leading-[1.45] text-neutral-500 text-pretty">
        {payCats.map((c) => c.label).join(' + ')} · {CHECKIN_PRESENT_PTS} pts each · {fmt(here * payCats.length * CHECKIN_PRESENT_PTS)} pts total. Posting also files tonight’s attendance — no second screen.
        {!live ? ' It goes to the youth pastor to approve.' : ''}
      </div>
      {!addOpen ? (
        <Btn variant="secondary" className="justify-center" onClick={() => setAddOpen(true)}>
          <Icon name="ph ph-user-plus" className="text-[15px]" />
          Check in a new student
        </Btn>
      ) : (
        <div className="flex flex-col gap-[9px] rounded-lg border border-accent-700 px-[14px] py-[13px]" style={{ background: 'color-mix(in srgb, var(--color-accent) 7%, transparent)' }}>
          <div className="text-[12.5px] font-medium leading-[1.2] text-neutral-100">New student on {team.name}</div>
          <div className="flex gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} className="input flex-1" placeholder="Full name" aria-label="Full name" />
            <input value={newGrade} onChange={(e) => setNewGrade(e.target.value)} className="input !w-[72px]" placeholder="Grade" aria-label="Grade" />
          </div>
          <div className="flex gap-2">
            <Btn variant="ghost" className="flex-1 justify-center" onClick={() => setAddOpen(false)}>
              Cancel
            </Btn>
            <Btn className="flex-[2] justify-center" onClick={addStudent}>
              Add &amp; check in
            </Btn>
          </div>
        </div>
      )}
      {!roster.length ? (
        <div className="flex flex-col items-start gap-[10px] rounded-lg border border-dashed border-neutral-700 px-4 py-[18px]">
          <Icon name="ph ph-users-three" className="text-[20px] text-neutral-500" />
          <div className="text-[12px] leading-[1.5] text-neutral-500 text-pretty">No students on {team.name} yet. The youth pastor assigns rosters from the web dashboard.</div>
        </div>
      ) : null}
      <div className="flex flex-col gap-[6px]">
        {roster.map((r) => {
          const on = !!d.tonight.presence[r.name];
          const det = d.tonight.checkinDetail[r.name];
          return (
            <div key={r.id} className="sr-card flex items-center gap-[9px] px-[11px] py-2">
              <button aria-label={r.name + ' is here'} aria-pressed={on} onClick={() => api().togglePresence(r.name)} className="flex h-11 w-11 flex-none items-center justify-center">
                <Icon name={on ? 'ph-fill ph-check-circle' : 'ph ph-circle'} className="text-[21px]" style={{ color: on ? 'var(--color-accent-200)' : 'var(--color-neutral-600)' }} />
              </button>
              <button onClick={() => openCheckin(r.name)} className="min-h-11 min-w-0 flex-1 text-left hover:opacity-80">
                <div className="truncate text-[13px] font-medium leading-[1.2] text-neutral-200">{r.name}</div>
                <div className="mt-[3px] text-[10.5px] leading-[1.3]" style={{ color: det ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }}>
                  {det ? 'Checked in · +' + fmt(det.pts) + (det.count ? ' · ' + det.count + ' extras' : '') : 'Grade ' + r.grade + (r.captain ? ' · Captain' : '')}
                </div>
              </button>
              <Btn variant="ghost" className="flex-none px-3" onClick={() => setLogFor(r.name)}>
                Log
              </Btn>
            </div>
          );
        })}
      </div>

      <Sheet open={!!checkin} onClose={() => setCheckin(null)} label={'Check in ' + (checkin ?? '')} z={82} maxH="90%">
        {checkin ? (
          <>
            <div className="flex items-start gap-[10px]">
              <div className="min-w-0 flex-1">
                <div className="text-[18px] font-medium leading-[1.2] text-neutral-100">{checkin}</div>
                <div className="mt-1 text-[11px] leading-[1.3] text-neutral-500">
                  {team.name} · week {d.config.weekNumber} values
                </div>
              </div>
              <button aria-label="Close coach check-in" onClick={() => setCheckin(null)} className="-mr-2 -mt-[6px] flex h-11 w-11 flex-none items-center justify-center text-neutral-500">
                <Icon name="ph ph-x" className="text-[15px]" />
              </button>
            </div>
            {d.tonight.checkinDetail[checkin] ? (
              <div className="flex items-center gap-2 rounded-md px-[11px] py-[9px]" style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' }}>
                <Icon name="ph-fill ph-check-circle" className="flex-none text-[15px] text-accent-200" />
                <div className="text-[11.5px] leading-[1.4] text-accent-100">Already checked in tonight. Posting again adds the difference on top.</div>
              </div>
            ) : null}
            <div className="flex flex-col gap-[7px]">
              {CHECKIN_QUESTIONS.map((q) => {
                const on = !!picks[q.id];
                return (
                  <button
                    key={q.id}
                    onClick={() => setPicks((p) => ({ ...p, [q.id]: !p[q.id] }))}
                    aria-pressed={on}
                    className="flex min-h-14 items-center gap-[11px] rounded-md border px-3 py-[9px] text-left"
                    style={{ borderColor: on ? 'var(--color-accent-600)' : 'var(--color-neutral-800)', background: on ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent' }}
                  >
                    <Icon name={on ? 'ph-fill ph-check-circle' : 'ph ph-circle'} className="flex-none text-[20px]" style={{ color: on ? 'var(--color-accent-200)' : 'var(--color-neutral-600)' }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium leading-[1.25]" style={{ color: on ? 'var(--color-neutral-100)' : 'var(--color-neutral-300)' }}>
                        {q.label}
                      </div>
                      <div className="mt-[3px] text-[10.5px] leading-[1.35] text-neutral-500 text-pretty">{q.hint}</div>
                    </div>
                    <span className="h-[9px] w-[9px] flex-none rounded-sm" style={{ background: catOf(d, q.cat).color }} />
                    <span className="tabular min-w-[46px] text-right text-[12px] font-semibold leading-none text-neutral-300">+{fmt(checkinQuestionPts(q, base))}</span>
                  </button>
                );
              })}
            </div>
            {CHECKIN_QUESTIONS.some((q) => q.cat === 'visitors' && picks[q.id]) ? (
              <input value={visitors} onChange={(e) => setVisitors(e.target.value)} className="input" placeholder="Visitor name(s) — e.g. Ava Collins" aria-label="Visitor names" />
            ) : null}
            <div className="flex items-center gap-[10px] border-t border-divider pt-[11px]">
              <div className="flex-1 text-[11px] leading-[1.4] text-neutral-500 text-pretty">{CHECKIN_PRESENT_PTS} for showing up, plus what you tick</div>
              <div className="tabular text-[19px] font-semibold leading-none text-accent-200">
                {fmt(CHECKIN_QUESTIONS.filter((q) => picks[q.id]).reduce((n, q) => n + checkinQuestionPts(q, base), CHECKIN_PRESENT_PTS))}
              </div>
            </div>
            <Btn
              className="min-h-[50px] justify-center"
              onClick={() => {
                if (postCoachCheckin(api, checkin, teamId, picks, visitors)) setCheckin(null);
              }}
            >
              Check in as present
            </Btn>
          </>
        ) : null}
      </Sheet>
      {logFor ? <StudentSheet open onClose={() => setLogFor(null)} initialTeam={teamId} initialName={logFor} /> : null}
    </Screen>
  );
}
