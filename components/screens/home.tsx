'use client';
/* HOME — the role card, tonight's card, approvals, standings (the old
   Scoreboard, merged in), recent changes, badges, quick links, church info.
   The first card is shaped by role (buildRoleFocus in the design). */
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { StandingsCard, useStandings } from '@/components/dashboard/standings-list';
import { TonightCard } from '@/components/dashboard/tonight-card';
import { CheckInCard, ParentTonight } from '@/components/cycle/home-cards';
import { Sheet } from '@/components/sheet';
import { Avatar, Btn, Icon, Screen, Stat, initialsOf } from '@/components/ui';
import { ago } from '@/lib/dates';
import { challengesIn, churchRows, churchSocials } from '@/lib/feeds';
import { groupHeldEntries, heldTotal, wasHeld } from '@/lib/held';
import { autoApproves, canApprove, canControlEvent, canHuddle } from '@/lib/permissions';
import { deltaLabel, fmt, pointBase, studentRanks, studentTotal } from '@/lib/scoring';
import { catOf, computeBadges, computeNotifications, eventLabel, myBible, myTeamId, sheetMinutes, teamOf, teamRoster, upcomingEvents } from '@/lib/selectors';
import { notifOn, usePrefs } from '@/lib/prefs';
import { useNow } from '@/lib/use-now';
import { useApp, useAppApi } from '@/lib/store/provider';

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : 'Good evening,';
}

export function HomeScreen() {
  const api = useAppApi();
  const params = useSearchParams();
  const m = useApp((s) => s.membership);
  const d = useApp((s) => s.data);
  const coachTeam = useApp((s) => s.coachTeam);
  const rows = useStandings();
  const prefs = usePrefs();
  const notifs = useMemo(() => computeNotifications(d, m, notifOn(d.config.notifDefaults, prefs.notifMine)), [d, m, prefs.notifMine]);

  useEffect(() => {
    if (params.get('denied')) api().say('Your role does not have that screen.');
  }, [params, api]);

  const p = m.persona;
  const base = pointBase(d.config);
  const teamId = myTeamId(m, d, coachTeam);
  const team = teamOf(d, teamId);
  const row = rows.find((r) => r.id === teamId) ?? rows[0];
  const roster = teamRoster(d, teamId);
  const here = roster.filter((r) => d.tonight.presence[r.name]).length;
  const missing = roster.length - here;
  const firstRun = d.ledger.length === 0;
  const checkedIn = d.roster.filter((r) => d.tonight.presence[r.name]).length;

  return (
    <Screen label="Home">
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10.5px] font-semibold uppercase leading-none tracking-[.13em] text-accent-400">{d.config.ministryName}</div>
          <h1 className="mt-[7px] text-[25px] font-medium leading-[1.15] text-neutral-100">
            {greeting()}
            <br />
            {m.firstName}
          </h1>
        </div>
        <div className="flex flex-none items-center gap-2">
          <Link
            href="/dashboard/notifications"
            aria-label={notifs.length ? 'Notifications, ' + notifs.length + ' new' : 'Notifications'}
            className="relative flex h-11 w-11 items-center justify-center rounded-full border border-neutral-800 bg-surface text-neutral-300"
          >
            <Icon name="ph ph-bell" className="text-[17px]" />
            {notifs.length ? (
              <span className="absolute -right-[3px] -top-[3px] h-4 min-w-4 rounded-full bg-accent-400 px-[3px] text-center text-[9px] font-bold leading-4 text-bg">{notifs.length}</span>
            ) : null}
          </Link>
          <button
            aria-label={m.initials + ' — signed in as ' + m.displayName + '. Switch role'}
            onClick={() => api().setRoleSheet(true)}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-accent-800 text-[14px] font-semibold text-accent-200"
            style={{ boxShadow: '0 0 0 1px var(--color-accent-600), 0 0 22px -6px var(--color-accent-600)' }}
          >
            {m.initials}
          </button>
        </div>
      </div>

      {canApprove(p) ? <TonightCard /> : null}
      {firstRun && canApprove(p) ? <FirstRunCard /> : null}

      {/* the role-shaped first card */}
      {p === 'coach' ? (
        <RoleFocus
          kicker="Your squad · tonight"
          title={team.name}
          accent={team.color}
          sub={(() => {
            const rec = d.tonight.checkinPosted[teamId];
            if (rec) {
              if (wasHeld(rec)) return 'Attendance marked. The points are held on this phone until you have signal.';
              return autoApproves(p) ? 'Attendance posted. Points are on the board.' : 'Attendance posted. The points are waiting on the youth pastor to approve.';
            }
            return here ? here + ' marked here — posting pays ' + fmt(here * 50) + ' pts.' : 'Nobody marked yet. Start with who you can see.';
          })()}
          stats={[
            { label: 'Here', value: here + ' / ' + roster.length, hint: missing ? missing + ' not marked' : 'everyone in' },
            { label: 'Squad rank', value: '#' + (row?.rank ?? 1), hint: row ? deltaLabel(row) : '' }
          ]}
          action={d.tonight.checkinPosted[teamId] ? (wasHeld(d.tonight.checkinPosted[teamId]) ? 'Review what is held' : 'Open Coach view') : 'Mark who is here'}
          href="/dashboard/coach-view"
        />
      ) : null}
      {p === 'scorekeeper' ? (
        <RoleFocus
          kicker={'Scoring · week ' + d.config.weekNumber}
          title="Score a squad"
          accent="var(--color-accent-500)"
          sub={(d.config.gameName || 'Tonight’s game') + ' is tonight’s game. What you post goes straight to the board.'}
          stats={[
            { label: 'Point base', value: fmt(base), hint: 'grows each week' },
            { label: 'Your posts', value: 'Live', hint: 'no review queue' }
          ]}
          action="Open the score pad"
          href="/dashboard/score"
        />
      ) : null}
      {p === 'owner' ? (
        <RoleFocus
          kicker="Oversight"
          title="Organization"
          accent="var(--color-accent-500)"
          sub={(() => {
            const acc = d.accessRequests.filter((r) => r.status === 'pending').length;
            return acc ? acc + ' people are waiting on access.' : 'No access requests waiting.';
          })()}
          stats={[
            { label: 'People', value: String(d.roster.length), hint: 'on the roster' },
            (() => {
              const acc = d.accessRequests.filter((r) => r.status === 'pending').length;
              return { label: 'Access requests', value: String(acc), hint: acc ? 'needs a decision' : 'clear' };
            })()
          ]}
          action="Open the console"
          href="/console"
        />
      ) : null}
      {p === 'member' || p === 'captain' ? <CheckInCard /> : null}
      {p === 'member' || p === 'captain' ? <StudentCard /> : null}
      {p === 'captain' ? (
        <RoleFocus
          kicker="You captain"
          title={team.name}
          accent={team.color}
          sub={missing ? missing + ' of your squad are not here yet.' : 'Your whole squad is here.'}
          stats={[
            { label: 'Squad rank', value: '#' + (row?.rank ?? 1), hint: row ? deltaLabel(row) : '' },
            { label: 'Not here yet', value: String(missing), hint: missing ? 'text them' : 'all in' }
          ]}
          action="Nudge your squad"
          href="/dashboard/captain-view"
        />
      ) : null}
      {p === 'parent' ? <ParentTonight /> : null}
      {p === 'parent' ? <ParentCard /> : null}

      {/* tonight */}
      {!firstRun ? (
        <div className="sr-dark relative overflow-hidden rounded-lg px-4 pb-[14px] pt-4" style={{ background: 'linear-gradient(160deg,var(--color-section) 0%,#1d2044 70%)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="absolute inset-0 opacity-70" style={{ background: 'radial-gradient(90% 120% at 100% 0%, var(--color-section-glow) 0%, transparent 60%)' }} />
          <div className="relative flex flex-col gap-[11px]">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-accent-300">Week {d.config.weekNumber} · tonight</span>
              <span className="h-px flex-1" style={{ background: 'linear-gradient(90deg,var(--color-accent-700),transparent)' }} />
            </div>
            <div className="text-[19px] font-medium leading-[1.25] text-neutral-100">{(d.config.gameName || 'Game night') + ' · Main Gym'}</div>
            <div className="text-[12.5px] leading-[1.5] text-neutral-300">{tonightLine(d)}</div>
            <div className="mt-[2px] flex items-center gap-2">
              <div className="flex-1 rounded-md px-[11px] py-[9px]" style={{ background: 'rgba(0,0,0,.28)' }}>
                <div className="text-[10px] uppercase leading-none tracking-[.08em] text-accent-300">Point base</div>
                <div className="mt-1 text-[17px] font-semibold leading-[1.2] text-neutral-100">{fmt(base)} pts</div>
              </div>
              <div className="flex-1 rounded-md px-[11px] py-[9px]" style={{ background: 'rgba(0,0,0,.28)' }}>
                <div className="text-[10px] uppercase leading-none tracking-[.08em] text-accent-300">Checked in</div>
                <div className="tabular mt-1 text-[17px] font-semibold leading-[1.2] text-neutral-100">
                  {checkedIn} <span className="text-[12px] font-normal text-neutral-400">/ {d.roster.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {canApprove(p) ? <WaitingOnYou /> : null}
      <StaleHeldCard />
      <OutboxCard />
      {prefs.homeSections.standings ? <StandingsCard /> : null}
      {!firstRun && prefs.homeSections.feed ? <RecentChanges /> : null}
      {prefs.homeSections.badges ? <BadgesStrip /> : null}

      {/* quick links */}
      <div className="grid grid-cols-2 gap-[10px]">
        {[
          canHuddle(p) ? { label: 'Huddle', meta: d.huddle.runSheet.length ? d.huddle.runSheet[Math.min(d.huddle.runIdx, d.huddle.runSheet.length - 1)].time + ' · ' + d.huddle.runSheet[Math.min(d.huddle.runIdx, d.huddle.runSheet.length - 1)].label : 'no run sheet yet', icon: 'ph ph-users-four', href: '/dashboard/huddle' } : null,
          { label: 'Bible & Memory', meta: myBible(d, m).due + (myBible(d, m).due === 1 ? ' verse due' : ' verses due'), icon: 'ph ph-book-open-text', href: '/dashboard/bible' },
          { label: 'Media', meta: 'Week ' + d.config.weekNumber + ' album', icon: 'ph ph-camera', href: '/dashboard/media' },
          canControlEvent(p) ? { label: 'Game timer', meta: d.config.gameName || 'no game set', icon: 'ph ph-timer', href: '/dashboard/games' } : null,
          { label: 'Calendar', meta: upcomingEvents(d, p)[0] ? 'Next: ' + eventLabel(upcomingEvents(d, p)[0]) : 'nothing scheduled', icon: 'ph ph-calendar-dots', href: '/dashboard/calendar' },
          { label: 'Prayer request', meta: 'Ask your leaders to pray', icon: 'ph ph-hands-praying', href: '/dashboard/follow-ups' },
          { label: 'Join a challenge', meta: challengesIn(d.challenges, d.config.weekNumber).length ? challengesIn(d.challenges, d.config.weekNumber).length + ' running' : 'Nothing running yet', icon: 'ph ph-flag-checkered', href: '/dashboard/races' }
        ]
          .filter(Boolean)
          .map((q) => (
            <Link
              key={q!.label}
              href={q!.href}
              className="flex min-h-[76px] flex-col gap-2 rounded-lg border border-neutral-800 bg-surface px-[13px] pb-3 pt-[13px] text-left hover:border-accent-600"
              style={{ color: 'inherit' }}
            >
              <Icon name={q!.icon} className="text-[19px] text-accent-400" />
              <div>
                <div className="text-[13px] font-medium leading-[1.2] text-neutral-200">{q!.label}</div>
                <div className="mt-[3px] text-[11px] leading-[1.3] text-neutral-500">{q!.meta}</div>
              </div>
            </Link>
          ))}
      </div>

      {prefs.homeSections.church ? <ChurchCard /> : null}
    </Screen>
  );
}

function tonightLine(d: ReturnType<typeof useAppData>) {
  const sheet = d.huddle.runSheet;
  const find = (label: string) => sheet.find((x) => x.label.toLowerCase().startsWith(label));
  const short = (t: string | undefined) => (t ? t.replace(/:00/, '').replace(/([ap])m$/, '$1') : '');
  const doors = find('doors');
  const games = find('games');
  const lesson = find('lesson');
  const bits = [
    doors ? { at: sheetMinutes(doors.time) ?? 0, label: short(doors.time) + ' doors' } : null,
    games ? { at: sheetMinutes(games.time) ?? 0, label: short(games.time) + ' games' } : null,
    lesson ? { at: sheetMinutes(lesson.time) ?? 0, label: short(lesson.time) + ' Word' } : null
  ]
    .filter((b): b is { at: number; label: string } => !!b)
    .sort((a, b) => a.at - b.at)
    .map((b) => b.label);
  return bits.length ? bits.join(' · ') : 'Set the run of show in the huddle sheet.';
}

function useAppData() {
  return useApp((s) => s.data);
}

function RoleFocus({
  kicker, title, accent, sub, stats, action, href
}: { kicker: string; title: string; accent: string; sub: string; stats: { label: string; value: string; hint: string }[]; action: string; href: string }) {
  return (
    <div className="sr-card relative flex flex-col gap-3 overflow-hidden px-[15px] py-[14px]">
      <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: accent }} />
      <div>
        <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">{kicker}</div>
        <div className="mt-[7px] text-[19px] font-medium leading-[1.2] text-neutral-100">{title}</div>
        <div className="mt-[6px] text-[12.5px] leading-[1.5] text-neutral-400 text-pretty">{sub}</div>
      </div>
      <div className="flex gap-[9px]">
        {stats.map((s) => (
          <Stat key={s.label} label={s.label} value={s.value} hint={s.hint} />
        ))}
      </div>
      <Btn href={href} className="justify-center">
        {action}
      </Btn>
    </div>
  );
}

function StudentCard() {
  const m = useApp((s) => s.membership);
  const d = useAppData();
  const rows = useStandings();
  const me = d.roster.find((r) => r.name === m.studentName) ?? d.roster[0];
  const ranked = useMemo(() => studentRanks(d.roster, d.ledger, d.studentSeedPoints), [d.roster, d.ledger, d.studentSeedPoints]);
  if (!me) return null;
  const tm = teamOf(d, me.team);
  const tr = rows.find((r) => r.id === tm.id);
  const b = d.studentBadges.find((x) => x.name === me.name);
  const myRank = ranked.find((r) => r.name === me.name)?.rank ?? ranked.length;
  return (
    <div className="sr-card flex flex-col gap-3 px-[15px] py-[14px]">
      <div className="flex items-center gap-[11px]">
        <Avatar initials={initialsOf(me.name)} color={tm.color} />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium leading-[1.2] text-neutral-100">{me.name}</div>
          <div className="mt-[3px] text-[11px] leading-[1.3] text-neutral-500">
            {tm.name} is #{tr?.rank ?? '–'} · {fmt(tr?.total ?? 0)} pts
          </div>
        </div>
      </div>
      <div className="flex gap-[9px]">
        <Stat label="Your points" value={fmt(studentTotal(me.name, d.ledger, d.studentSeedPoints))} hint={'#' + myRank + ' of ' + d.roster.length + ' students'} />
        <div className="flex-1 rounded-md bg-neutral-900 px-[11px] py-[10px]">
          <div className="text-[9.5px] uppercase leading-none tracking-[.08em] text-neutral-500">Streaks</div>
          <div className="mt-[5px] text-[12px] font-medium leading-[1.4] text-neutral-200">Attendance {b ? b.attendStreak + ' weeks' : 'Not started'}</div>
          <div className="text-[12px] font-medium leading-[1.4] text-neutral-200">Bible {b ? Math.ceil(b.bibleStreak / 7) + ' weeks' : 'Not started'}</div>
        </div>
      </div>
      {challengesIn(d.challenges, d.config.weekNumber).length ? (
        <div className="flex flex-col gap-[7px] border-t border-divider pt-[11px]">
          <div className="text-[9.5px] font-semibold uppercase leading-none tracking-[.1em] text-neutral-500">This week</div>
          {challengesIn(d.challenges, d.config.weekNumber).slice(0, 3).map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <Icon name="ph ph-target" className="mt-[2px] flex-none text-[13px] text-accent-400" />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] leading-[1.35] text-neutral-200 text-pretty">{c.title}</div>
                <div className="mt-[2px] text-[10px] leading-[1.3] text-neutral-500">
                  {c.kind} · {c.pointsLabel}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ParentCard() {
  const m = useApp((s) => s.membership);
  const d = useAppData();
  const kid = d.roster.find((r) => r.name === m.studentName);
  if (!kid) return null;
  const tm = teamOf(d, kid.team);
  const b = d.studentBadges.find((x) => x.name === kid.name);
  const next = upcomingEvents(d, 'parent')[0];
  return (
    <div className="sr-card px-[15px] py-[14px]">
      <div className="mb-2 text-[10.5px] uppercase leading-none tracking-[.08em] text-neutral-500">Watching</div>
      <div className="mb-[10px] flex items-center gap-2">
        <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: tm.color }} />
        <div className="text-[15px] font-medium leading-[1.2] text-neutral-100">
          {kid.name} <span className="font-normal text-neutral-500">· {tm.name}</span>
        </div>
      </div>
      <div className="flex gap-[10px]">
        <div className="flex-1 rounded-md bg-neutral-900 px-[11px] py-[10px]">
          <div className="text-[9.5px] uppercase leading-none tracking-[.08em] text-neutral-500">Attendance</div>
          <div className="mt-1 text-[12.5px] font-medium leading-[1.4] text-neutral-200">{b ? b.attendStreak + ' week attendance streak' : 'Not started'}</div>
        </div>
        <div className="flex-1 rounded-md bg-neutral-900 px-[11px] py-[10px]">
          <div className="text-[9.5px] uppercase leading-none tracking-[.08em] text-neutral-500">Bible</div>
          <div className="mt-1 text-[12.5px] font-medium leading-[1.4] text-neutral-200">{b ? Math.ceil(b.bibleStreak / 7) + ' week Bible streak' : 'Not started'}</div>
        </div>
      </div>
      {next ? <div className="mt-[10px] text-[11px] leading-[1.4] text-neutral-500">Next: {next.title + ' · ' + next.date}</div> : null}
    </div>
  );
}

function FirstRunCard() {
  const d = useAppData();
  const steps = [
    { id: 'squads', label: 'Name your squads', meta: d.teams.length ? d.teams.length + ' set up' : 'none yet', done: d.teams.length > 1, href: '/console?tab=teams' },
    { id: 'roster', label: 'Add your students', meta: d.roster.length ? d.roster.length + ' on the roster' : 'import from Planning Center or type them in', done: d.roster.length > 0, href: '/console?tab=people' },
    { id: 'dates', label: 'Set your meeting nights', meta: d.config.meetingDates.length ? d.config.meetingDates.length + ' on the calendar' : 'none on the calendar', done: d.config.meetingDates.length > 0, href: '/console?tab=scoring' },
    { id: 'invite', label: 'Invite your leaders', meta: 'coaches, captains, parents', done: false, href: '/console?tab=people' }
  ];
  const n = steps.filter((s) => s.done).length;
  return (
    <div className="sr-card overflow-hidden">
      <div className="flex flex-col gap-[5px] px-[15px] pb-[13px] pt-[15px]">
        <div className="text-[10px] font-semibold uppercase leading-none tracking-[.13em] text-accent-300">Before week one</div>
        <div className="text-[17px] font-medium leading-[1.25] text-neutral-100">Nothing has happened yet</div>
        <div className="text-[11.5px] leading-[1.55] text-neutral-500 text-pretty">The board stays at zero until the first game. Four things have to exist before then — the rest of the app waits on these.</div>
        <div className="mt-[6px] flex items-center gap-[9px]">
          <div className="h-1 flex-1 overflow-hidden rounded-sm bg-neutral-800">
            <div className="h-full bg-accent-500" style={{ width: Math.round((n / steps.length) * 100) + '%', transition: 'width .3s ease' }} />
          </div>
          <div className="flex-none text-[10.5px] leading-none text-neutral-500">{n === steps.length ? 'You are ready for week one.' : n + ' of ' + steps.length + ' done'}</div>
        </div>
      </div>
      {steps.map((st) => (
        <Link key={st.id} href={st.href} className="flex min-h-[52px] items-center gap-[10px] border-t border-divider pr-[14px] sr-hover" style={{ color: 'inherit' }}>
          <div className="flex h-[52px] w-11 flex-none items-center justify-center" style={{ color: st.done ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }}>
            <Icon name={st.done ? 'ph-fill ph-check-circle' : 'ph ph-circle'} className="text-[17px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium leading-[1.3]" style={{ color: st.done ? 'var(--color-neutral-500)' : 'var(--color-neutral-100)', textDecoration: st.done ? 'line-through' : 'none' }}>
              {st.label}
            </div>
            <div className="mt-[3px] truncate text-[10.5px] leading-[1.35] text-neutral-500">{st.meta}</div>
          </div>
          <Icon name="ph ph-caret-right" className="flex-none text-[13px] text-neutral-600" />
        </Link>
      ))}
    </div>
  );
}

/** The approval queue, on Home. One row per submission — a coach's 28-student
 *  attendance is ONE row (one batch), cleared in one tap. */
export function usePendingGroups() {
  const d = useAppData();
  return useMemo(() => {
    const groups = new Map<string, { key: string; ids: string[]; team: string; cat: string; amount: number; by: string; why: string; count: number; at: number; cats: Set<string>; photo: string | null }>();
    for (const e of d.ledger) {
      if (e.status !== 'pending') continue;
      const key = e.batch ?? e.id;
      const g = groups.get(key) ?? { key, ids: [], team: e.team, cat: e.cat, amount: 0, by: e.by, why: e.why, count: 0, at: e.at, cats: new Set<string>(), photo: null as string | null };
      if (e.detail?.photo) g.photo = e.detail.photo;
      g.ids.push(e.id);
      g.amount += e.amount;
      g.count++;
      g.cats.add(e.cat);
      groups.set(key, g);
    }
    return [...groups.values()].sort((a, b) => b.at - a.at);
  }, [d.ledger]);
}

export function WaitingOnYou() {
  const d = useAppData();
  const api = useAppApi();
  const groups = usePendingGroups();
  const [proof, setProof] = useState<string | null>(null);
  if (!groups.length) return null;
  const all = groups.flatMap((g) => g.ids);
  const decide = (ids: string[], ok: boolean, team: string, amount: number, by: string) => {
    const flag = api().decide(ids, ok ? 'approved' : 'rejected');
    if (!flag) return;
    if (ok) api().sayPosted('Approved — ' + fmt(amount) + ' to ' + teamOf(d, team).name + '.', 'Approved — ' + fmt(amount) + ' held until you have signal.');
    else api().say('Sent back to ' + by + ' with a note.');
  };
  return (
    <div className="sr-card overflow-hidden">
      <div className="flex items-center gap-[9px] px-[15px] pb-[11px] pt-[13px]">
        <Icon name="ph-fill ph-seal-check" className="text-[17px] text-accent-400" />
        <div className="text-[14px] font-medium leading-none text-neutral-100">Waiting on you</div>
        <div className="ml-auto rounded-full bg-accent-800 px-[9px] py-[5px] text-[11px] font-semibold leading-none text-accent-200">{groups.length} pending</div>
      </div>
      {groups.length > 1 ? (
        <div className="flex gap-2 border-b border-divider px-[15px] pb-[11px]">
          <Btn
            className="px-[14px]"
            onClick={() => {
              if (api().decide(all, 'approved')) api().sayPosted('Approved all ' + groups.length + ' pending requests.', 'Approved all ' + groups.length + ' — held until you have signal.');
            }}
          >
            Approve all {groups.length}
          </Btn>
          <Btn
            variant="ghost"
            className="px-[14px]"
            onClick={() => {
              if (api().decide(all, 'rejected')) api().say('Sent back ' + groups.length + ' pending requests.');
            }}
          >
            Deny all
          </Btn>
        </div>
      ) : null}
      {groups.map((g) => {
        const t = teamOf(d, g.team);
        const catLabel = g.cats.size > 1 ? [...g.cats].map((c) => catOf(d, c).label).join(' + ') : catOf(d, g.cat).label;
        return (
          <div key={g.key} className="flex items-center gap-[11px] border-t border-divider px-[15px] py-[11px] animate-sr-rise">
            <div className="h-[34px] w-[3px] flex-none rounded-sm" style={{ background: t.color }} />
            {g.photo ? (
              <button aria-label="See the photo proof" onClick={() => setProof(g.photo)} className="h-11 w-11 flex-none rounded-md bg-neutral-900 bg-cover bg-center" style={{ backgroundImage: 'url(' + g.photo + ')', boxShadow: 'inset 0 0 0 1px var(--color-neutral-700)' }} />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-medium leading-[1.3] text-neutral-200">
                {g.by}: {g.amount > 0 ? '+' : ''}
                {fmt(g.amount)} → {t.name}
              </div>
              <div className="mt-[3px] text-[11.5px] leading-[1.4] text-neutral-500">
                {catLabel} · {g.count > 1 ? g.count + ' entries · ' : ''}
                {g.count > 1 ? g.why.split(' · ').slice(-1)[0] : g.why}
              </div>
            </div>
            <div className="flex flex-none gap-[6px]">
              <button aria-label="Deny" onClick={() => decide(g.ids, false, g.team, g.amount, g.by)} className="flex h-11 w-11 items-center justify-center rounded-md border border-neutral-800 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200">
                <Icon name="ph ph-x" className="text-[15px]" />
              </button>
              <button
                aria-label="Approve"
                onClick={() => decide(g.ids, true, g.team, g.amount, g.by)}
                className="flex h-11 w-11 items-center justify-center rounded-md border border-accent-600 text-accent-200"
                style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' }}
              >
                <Icon name="ph ph-check" className="text-[16px]" />
              </button>
            </div>
          </div>
        );
      })}
      <Sheet open={!!proof} onClose={() => setProof(null)} label="Photo proof" z={92}>
        <div className="text-[15px] font-medium leading-[1.2] text-neutral-100">Photo proof</div>
        {/* A small data URL taken on the sender's phone. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {proof ? <img src={proof} alt="Photo proof sent with the request" className="w-full rounded-md" /> : null}
        <Btn variant="ghost" className="justify-center" onClick={() => setProof(null)}>
          Close
        </Btn>
      </Sheet>
    </div>
  );
}

/** "Held from an earlier night" — stale work is quarantined, not replayed. */
function StaleHeldCard() {
  const stale = useApp((s) => s.staleHeld);
  const offline = useApp((s) => !s.netOnline || s.offlineSim);
  const api = useAppApi();
  const now = useNow(false);
  if (!stale) return null;
  const n = heldTotal(stale);
  const sum = stale.outbox.reduce((t, q) => t + (q.kind === 'entry' ? q.entry.amount : 0), 0);
  const entries = stale.outbox.filter((q) => q.kind === 'entry').length;
  const dt = new Date(stale.since);
  const days = Math.floor((now - stale.since) / 86_400_000);
  const time = dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '');
  const when = 'from ' + (days >= 6 ? dt.toLocaleDateString([], { month: 'short', day: 'numeric' }) : dt.toLocaleDateString([], { weekday: 'long' })) + ', ' + time;
  return (
    <div className="sr-card overflow-hidden border border-neutral-700">
      <div className="flex items-start gap-[9px] px-[15px] pb-[9px] pt-[13px]">
        <Icon name="ph ph-clock-counter-clockwise" className="mt-[1px] flex-none text-[17px] text-accent-300" />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium leading-[1.2] text-neutral-100">Held from an earlier night</div>
          <div className="mt-[3px] text-[11px] leading-[1.4] text-neutral-500">
            {n + (n === 1 ? ' item' : ' items') + ' never sent'} · {when}
          </div>
        </div>
      </div>
      <div className="px-[15px] pb-3 pl-[39px] text-[11.5px] leading-[1.5] text-neutral-400 text-pretty">
        Old enough that sending them now would land on tonight’s board. Nothing moves until you say so.
      </div>
      {entries ? (
        <div className="flex items-center gap-[10px] border-t border-divider px-[15px] py-[10px]">
          <Icon name="ph ph-trophy" className="flex-none text-[13px] text-neutral-500" />
          <div className="min-w-0 flex-1 text-[12px] leading-[1.35] text-neutral-300">
            {entries + (entries === 1 ? ' score entry' : ' score entries')} · {(sum > 0 ? '+' : '') + fmt(sum)} pts
          </div>
        </div>
      ) : null}
      <div className="flex gap-2 border-t border-divider px-[15px] pb-[13px] pt-[11px]">
        <Btn className="flex-1 text-[12px]" onClick={() => api().sendStaleHeld()}>
          {offline ? 'Move to the outbox' : 'Send them now'}
        </Btn>
        <Btn variant="ghost" className="flex-none px-[14px] text-[12px] !text-neutral-400" onClick={() => api().discardStaleHeld()}>
          Discard
        </Btn>
      </div>
    </div>
  );
}

/** "Held on this phone" — grouped by squad × category, so 56 rows read as two. */
function OutboxCard() {
  const d = useAppData();
  const outbox = useApp((s) => s.outbox);
  const syncing = useApp((s) => s.outboxSyncing);
  const error = useApp((s) => s.outboxError);
  const offline = useApp((s) => !s.netOnline || s.offlineSim);
  const api = useAppApi();
  const groups = useMemo(() => groupHeldEntries(outbox), [outbox]);
  if (!outbox.length) return null;
  const entries = outbox.filter((o) => o.kind === 'entry');
  const decisions = outbox.length - entries.length;
  const sum = entries.reduce((n, o) => n + (o.kind === 'entry' ? o.entry.amount : 0), 0);
  const since = Math.min(...outbox.map((o) => o.at));
  const a = ago(since);
  return (
    <div className="sr-card overflow-hidden border border-accent-700">
      <div className="flex items-center gap-[9px] px-[15px] pb-[11px] pt-[13px]">
        <Icon name="ph-fill ph-tray-arrow-up" className="flex-none text-[17px] text-accent-300" />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium leading-[1.2] text-neutral-100">Held on this phone</div>
          <div className="mt-[3px] text-[11px] leading-[1.3] text-neutral-500">
            {[entries.length ? entries.length + (entries.length === 1 ? ' score entry' : ' score entries') : null, decisions ? decisions + (decisions === 1 ? ' approval' : ' approvals') : null]
              .filter(Boolean)
              .join(' · ')}{' '}
            waiting
          </div>
          <div className="mt-[2px] text-[11px] leading-[1.3] text-neutral-500">
            {[entries.length ? (sum > 0 ? '+' : '') + fmt(sum) + ' pts' : null, a === 'just now' ? 'held just now' : 'waiting ' + a.replace(' ago', '')].filter(Boolean).join(' · ')}
          </div>
        </div>
        {syncing ? <div className="flex-none text-[10.5px] font-semibold leading-none text-accent-200">Sending…</div> : null}
      </div>
      {error && !syncing ? (
        <div role="status" aria-live="polite" className="flex items-start gap-[9px] border-t border-divider px-[15px] py-[11px]" style={{ background: 'color-mix(in srgb, var(--color-accent) 9%, transparent)' }}>
          <Icon name="ph ph-warning-circle" className="mt-[1px] flex-none text-[15px] text-accent-200" />
          <div className="min-w-0 flex-1 text-[11.5px] leading-[1.45] text-neutral-300 text-pretty">{error}</div>
          <Btn variant="secondary" className="flex-none px-3 text-[11.5px]" disabled={syncing || offline} onClick={() => api().flushOutbox()}>
            {offline ? 'Still no signal' : 'Try again'}
          </Btn>
        </div>
      ) : null}
      {groups.map((g) => (
        <div key={g.team + g.cat} className="flex items-center gap-[11px] border-t border-divider px-[15px] py-[11px]">
          <div className="h-[30px] w-[3px] flex-none rounded-sm" style={{ background: teamOf(d, g.team).color }} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-medium leading-[1.3] text-neutral-200">
              {(g.amount > 0 ? '+' : '') + fmt(g.amount)} {catOf(d, g.cat).label} → {teamOf(d, g.team).name}
            </div>
            <div className="mt-[3px] text-[11px] leading-[1.3] text-neutral-500">{g.count + (g.count === 1 ? ' entry' : ' entries')}</div>
          </div>
        </div>
      ))}
      <div className="border-t border-divider px-[15px] pb-[13px] pt-[11px] text-[11px] leading-[1.5] text-neutral-500 text-pretty">
        Nothing is lost. These send themselves in order the moment you have signal again — you do not have to come back here.
      </div>
    </div>
  );
}

function RecentChanges() {
  const d = useAppData();
  const me = useApp((s) => s.membership.displayName);
  const feed = useMemo(() => d.ledger.filter((e) => e.status === 'approved' && !e.by.startsWith('Weeks ')).slice(0, 6), [d.ledger]);
  if (!feed.length) return null;
  return (
    <div className="sr-card overflow-hidden">
      <div className="px-[15px] pb-[11px] pt-[13px] text-[14px] font-medium leading-none text-neutral-100">Recent score changes</div>
      {feed.map((f) => {
        const by = f.by.startsWith(me) ? f.by.replace(me, 'You') : f.by;
        return (
          <div key={f.id} className="flex items-center gap-[10px] border-t border-divider px-[15px] py-[11px] animate-sr-rise">
            <div className="h-2 w-2 flex-none rounded-full" style={{ background: teamOf(d, f.team).color }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-medium leading-[1.3] text-neutral-200">
                {catOf(d, f.cat).label} → {teamOf(d, f.team).name}
              </div>
              <div className="mt-[3px] text-[11px] leading-[1.3] text-neutral-500">
                {by} · {ago(f.at)}
              </div>
              {f.why ? (
                /* On a deduction the reason is the whole point of the entry. */
                <div className="mt-1 text-[11px] leading-[1.4] text-pretty" style={{ color: f.amount < 0 ? 'var(--color-over)' : 'var(--color-neutral-400)' }}>
                  {f.why}
                </div>
              ) : null}
            </div>
            <div className="tabular flex-none text-[13px] font-semibold leading-none" style={{ color: f.amount > 0 ? 'var(--color-accent-300)' : '#e08a8a' }}>
              {(f.amount > 0 ? '+' : '') + fmt(f.amount)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BadgesStrip() {
  const d = useAppData();
  const badges = useMemo(() => computeBadges(d).filter((b) => b.tier), [d]);
  if (!badges.length) return null;
  return (
    <div>
      <div className="mb-[9px] flex items-center justify-between">
        <div className="text-[13px] font-medium leading-none text-neutral-100">This week’s badges</div>
        <Link href="/dashboard/badges" className="flex min-h-11 items-center px-1 text-[12px] font-medium text-accent-300">
          See all →
        </Link>
      </div>
      <div className="flex gap-[9px] overflow-x-auto pb-[2px]" style={{ scrollSnapType: 'x proximity' }}>
        {badges.map((b) => {
          const t = teamOf(d, b.teamId);
          return (
            <Link
              key={b.name}
              href="/dashboard/badges"
              className="flex min-w-[104px] flex-none flex-col gap-[6px] rounded-lg px-3 py-[11px] text-left"
              style={{ scrollSnapAlign: 'start', background: 'color-mix(in srgb, ' + t.color + ' 30%, var(--color-neutral-900))', color: 'inherit' }}
            >
              <Icon name={b.tier === 'Gold' ? 'ph-fill ph-crown' : b.tier === 'Silver' ? 'ph-fill ph-trophy' : 'ph ph-medal'} className="text-[16px] text-accent-200" />
              <div className="truncate text-[11.5px] font-medium leading-[1.2] text-neutral-100">{b.name}</div>
              <div className="text-[10.5px] leading-none text-accent-100">{b.tier}</div>
            </Link>
          );
        })}
        <Link href="/dashboard/badges" className="flex min-w-[74px] flex-none flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-700 text-neutral-400" style={{ color: 'var(--color-neutral-400)' }}>
          <Icon name="ph ph-arrow-right" className="text-[14px]" />
          <div className="text-[10px] font-medium leading-none">All badges</div>
        </Link>
      </div>
    </div>
  );
}

function ChurchCard() {
  const d = useAppData();
  const rows = churchRows(d.config.church);
  const socials = churchSocials(d.config.church);
  if (!rows.length && !socials.length) return null;
  return (
    <div className="sr-card flex flex-col gap-2 px-[15px] py-[14px]">
      <div className="flex items-center gap-2">
        <Icon name="ph ph-church" className="flex-none text-[16px] text-accent-400" />
        <div className="flex-1 text-[14px] font-medium leading-none text-neutral-100">{d.config.ministryName} · find us</div>
      </div>
      <div className="flex flex-col gap-[2px]">
        {rows.map((r) => (
          <a key={r.label} href={r.href} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-[11px] rounded-md p-1 sr-hover" style={{ color: 'inherit' }}>
            <Icon name={r.icon} className="flex-none text-[17px] text-accent-400" />
            <div className="min-w-0 flex-1">
              <div className="text-[9.5px] uppercase leading-none tracking-[.08em] text-neutral-500">{r.label}</div>
              <div className="mt-[3px] text-[12.5px] font-medium leading-[1.35] text-neutral-200 text-pretty">{r.value}</div>
            </div>
            <Icon name="ph ph-arrow-up-right" className="flex-none text-[13px] text-neutral-600" />
          </a>
        ))}
      </div>
      {socials.length ? (
        <div className="flex flex-wrap gap-2 border-t border-divider pt-[11px]">
          {socials.map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noreferrer" title={s.label} aria-label={s.label} className="flex h-11 w-11 items-center justify-center rounded-full border border-neutral-800 text-neutral-300 hover:border-accent-600 hover:text-accent-200">
              <Icon name={s.icon} className="text-[18px]" />
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
