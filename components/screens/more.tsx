'use client';
/* MORE — everything else, grouped by Account / Discipleship / Views /
   Tonight / Season / Oversight and filtered by role. Each row is withheld by
   the SAME function that gates its screen: a row you can see is a screen you
   can open, and the screen re-checks rather than trusting the menu. */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { InviteSheet } from '@/components/dashboard/invite-sheet';
import { useCycle } from '@/components/cycle/use-cycle';
import { CHAPTERS } from '@/lib/walkthrough';
import { crewAll } from '@/components/screens/huddle';
import { Icon, Screen } from '@/components/ui';
import { previewBlankDemo, resetDemo } from '@/lib/data/demo-backend';
import { startTour, tourSteps } from '@/components/shell/tour';
import { awardOpen } from '@/lib/awards';
import { heldTotal } from '@/lib/held';
import {
  canApprove, canControlEvent, canHuddle, canMessageParents, canNightRecap, canOpenLibrary, canOpenRoleView, canPrepWeek, canPublishBoard,
  canRunDoor, canRunLive, canSeeAttendance, canSeeCare, canServe, canShareRecap, canSwitchTeamView
} from '@/lib/permissions';
import { attendanceStats, checkinOpen, followups, isAfter, myNights, nextReminder, reminders, slipsView, weekday } from '@/lib/cycle';
import { computeNotifications, eventLabel, myBible, myTeamId, openFollowups, teamOf, upcomingEvents } from '@/lib/selectors';
import { notifOn, usePrefs } from '@/lib/prefs';
import { clearRecents, recentsOwner, recentsSnapshot, subscribeRecents } from '@/lib/recents';
import { useApp, useAppApi } from '@/lib/store/provider';
import { personaDef, realRole } from '@/lib/types/domain';

const NO_RECENTS: string[] = [];

interface Item {
  label: string;
  meta: string;
  icon: string;
  href?: string;
  onClick?: () => void;
}

export function MoreScreen() {
  const m = useApp((s) => s.membership);
  const d = useApp((s) => s.data);
  const coachTeam = useApp((s) => s.coachTeam);
  const offlineSim = useApp((s) => s.offlineSim);
  const outbox = useApp((s) => s.outbox.length);
  const stale = useApp((s) => s.staleHeld);
  const api = useAppApi();
  const router = useRouter();
  const [q, setQ] = useState('');
  const who = recentsOwner(m);
  const recentHrefs = useSyncExternalStore(subscribeRecents, () => recentsSnapshot(who), () => NO_RECENTS);
  const [invite, setInvite] = useState(false);
  const p = m.persona;
  const prefs = usePrefs();
  const notifs = useMemo(() => computeNotifications(d, m, notifOn(d.config.notifDefaults, prefs.notifMine)), [d, m, prefs.notifMine]);
  const myTeam = teamOf(d, myTeamId(m, d, coachTeam));
  const pendingAccess = d.accessRequests.filter((r) => r.status === 'pending').length;
  const pendingPts = new Set(d.ledger.filter((e) => e.status === 'pending').map((e) => e.batch ?? e.id)).size;
  const crewIds = crewAll(d.huddle).map((c) => c.id);
  const hereCount = crewIds.filter((id) => d.huddle.crewState[id] === 'here').length;
  const sheetNow = d.huddle.runSheet[Math.min(d.huddle.runIdx, Math.max(0, d.huddle.runSheet.length - 1))];
  const real = !!realRole(p);
  const cy = useCycle();
  const cyAfter = isAfter(cy.t, cy.now);
  const nextRem = canPrepWeek(p) ? nextReminder(reminders(d, cy.iso, cy.now)) : null;
  const myFu = cyAfter && canNightRecap(p) ? followups(d, cy.iso, cy.now, cy.me).filter((f) => f.mine && !f.done).length : 0;
  const swaps = d.serving.swaps.filter((x) => x.status === 'pending').length;
  const myServe = canServe(p) ? myNights(d, cy.me.name, cy.nights) : [];
  const firstSlip = slipsView(d)[0];

  const groups: { title: string; visible: boolean; items: (Item | null)[] }[] = [
    {
      title: 'Account',
      visible: true,
      items: [
        { label: 'Settings', meta: 'Dark', icon: 'ph ph-moon', href: '/dashboard/settings' },
        { label: 'Notifications', meta: notifs.length + ' new', icon: 'ph ph-bell', href: '/dashboard/notifications' },
        canApprove(p) ? { label: 'Access requests', meta: pendingAccess + ' waiting', icon: 'ph ph-user-focus', href: '/dashboard/access-requests' } : null,
        { label: 'Badges & Streaks', meta: 'season so far', icon: 'ph ph-medal', href: '/dashboard/badges' },
        canApprove(p)
          ? { label: 'Planning Center', meta: d.pco?.connected ? 'connected' + (d.pco.org ? ' · ' + d.pco.org : '') : m.mode === 'demo' ? 'on the live app' : 'not connected', icon: 'ph ph-plugs-connected', href: '/console?tab=people' }
          : null,
        canApprove(p) ? { label: 'Walkthrough', meta: CHAPTERS.length + ' chapters, in the order a week happens', icon: 'ph ph-compass', href: '/dashboard/walkthrough' } : null,
        /* Review affordance: the offline design is unreviewable without it. */
        { label: offlineSim ? 'Restore signal' : 'Simulate no signal', meta: outbox ? outbox + ' held' : 'try the gym case', icon: offlineSim ? 'ph ph-cloud-check' : 'ph ph-cloud-slash', onClick: () => api().toggleOfflineSim() },
        {
          label: stale ? 'Clear the old held queue' : 'Plant an old held queue',
          meta: stale ? heldTotal(stale) + ' items from 3 days ago' : 'the phone-in-a-drawer case',
          icon: 'ph ph-clock-counter-clockwise',
          onClick: () => api().plantStaleHeld()
        },
        m.mode === 'demo' && d.teams.length
          ? {
              label: 'Preview a brand-new season',
              meta: 'empty board, setup checklist',
              icon: 'ph ph-sparkle',
              onClick: () => {
                previewBlankDemo();
                /* A full load, so the demo reads the blank ministry back in. */
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                window.location.assign('/dashboard');
              }
            }
          : null,
        m.mode === 'demo'
          ? {
              label: 'Reset the demo',
              meta: 'back to week 9',
              icon: 'ph ph-arrow-counter-clockwise',
              onClick: () => {
                resetDemo();
                window.location.reload();
              }
            }
          : { label: 'Sign out', meta: m.displayName, icon: 'ph ph-sign-out', href: '/logout', onClick: clearRecents }
      ]
    },
    {
      title: 'Discipleship',
      visible: true,
      items: [
        { label: 'Bible & Memory', meta: myBible(d, m).due + ' due', icon: 'ph ph-book-open-text', href: '/dashboard/bible' },
        canSeeCare(p)
          ? { label: 'Prayer & Care', meta: d.prayerQueue.length + ' to review · ' + openFollowups(d).length + ' follow-ups', icon: 'ph ph-hands-praying', href: '/dashboard/follow-ups' }
          : { label: 'Prayer Wall', meta: d.prayers.length + ' on the wall', icon: 'ph ph-hands-praying', href: '/dashboard/follow-ups' }
      ]
    },
    {
      title: 'Views',
      visible: true,
      items: [
        canOpenRoleView(p, 'coach') ? { label: 'Coach view', meta: myTeam.name + ' · roster, attendance, points', icon: 'ph ph-megaphone', href: '/dashboard/coach-view' } : null,
        canOpenRoleView(p, 'captain') ? { label: 'Captain view', meta: 'who is missing · squad pushes', icon: 'ph ph-flag', href: '/dashboard/captain-view' } : null,
        canOpenRoleView(p, 'admin') ? { label: 'Admin view', meta: pendingAccess + ' waiting · org health', icon: 'ph ph-buildings', href: '/dashboard/admin-view' } : null,
        canOpenRoleView(p, 'parent') ? { label: 'Parent view', meta: (m.studentName ?? d.studentBadges[0]?.name ?? d.roster[0]?.name ?? '').split(' ')[0] + ' · one household', icon: 'ph ph-users', href: '/dashboard/parent-view' } : null,
        { label: 'Congregation view', meta: 'the public board', icon: 'ph ph-church', href: '/dashboard/congregation-view' },
        canOpenRoleView(p, 'team') ? { label: 'Team view', meta: myTeam.name + (canSwitchTeamView(p) ? ' · any squad' : ''), icon: 'ph ph-users-three', href: '/dashboard/team' } : null
      ]
    },
    {
      title: 'Tonight',
      visible: real,
      items: [
        { label: 'Live', meta: canRunLive(p) ? 'run ministry time' : 'answer on your phone', icon: 'ph ph-broadcast', href: '/dashboard/live' },
        canPrepWeek(p) ? { label: 'Prep week', meta: nextRem ? 'next: ' + nextRem.label.toLowerCase() : 'all reminders posted', icon: 'ph ph-calendar-check', href: '/dashboard/prep-week' } : null,
        canNightRecap(p)
          ? {
              label: 'Night recap',
              meta: cyAfter ? (myFu ? myFu + ' follow-ups yours' : 'follow-ups done') : checkinOpen(cy.t, cy.now) ? attendanceStats(d).here + ' checked in' : 'opens ' + weekday(cy.iso),
              icon: 'ph ph-clipboard-text',
              href: '/dashboard/night-recap'
            }
          : null,
        canServe(p)
          ? { label: 'Serving & swaps', meta: canApprove(p) ? (swaps ? swaps + ' swaps waiting' : 'no swaps') : myServe[0] ? myServe[0].role.toLowerCase() + ' · ' + myServe.length + ' nights' : 'not scheduled', icon: 'ph ph-swap', href: '/dashboard/serving' }
          : null,
        canMessageParents(p) ? { label: 'Message parents', meta: firstSlip ? firstSlip.signedN + ' of ' + firstSlip.total + ' signed · ' + firstSlip.slip.title.split(/ · | from /)[0] : 'families, slips, pickup', icon: 'ph ph-chat-circle-text', href: '/dashboard/parents' } : null,
        canRunDoor(p) ? { label: 'Door kiosk', meta: 'students check themselves in', icon: 'ph ph-device-tablet', href: '/dashboard/door' } : null,
        { label: canApprove(p) ? 'Leader tour' : 'Tour the app', meta: 'every screen in ' + tourSteps(p).length + ' steps', icon: 'ph ph-signpost', onClick: () => (startTour(), router.push('/dashboard')) },
        canHuddle(p) && sheetNow ? { label: 'Huddle & run sheet', meta: sheetNow.time + ' · ' + sheetNow.label + ' · ' + hereCount + ' of ' + crewIds.length + ' here', icon: 'ph ph-users-four', href: '/dashboard/huddle' } : null,
        canControlEvent(p) ? { label: 'Game timer', meta: 'week ' + d.config.weekNumber, icon: 'ph ph-timer', href: '/dashboard/games' } : null,
        { label: 'Submit Points', meta: 'with photo proof', icon: 'ph ph-paper-plane-tilt', href: '/dashboard/submit-points' },
        { label: 'Media & Film', meta: d.clips.length ? d.clips.length + ' clips · albums' : 'capture, film, albums', icon: 'ph ph-camera', href: '/dashboard/media' },
        { label: 'Game Rules', meta: d.config.gameName, icon: 'ph ph-clipboard-text', href: '/dashboard/game-rules' }
      ]
    },
    {
      title: 'Season',
      visible: real,
      items: [
        canShareRecap(p) ? { label: 'Weekly Recap Card', meta: 'share the week', icon: 'ph ph-share-network', href: '/dashboard/recap' } : null,
        canSeeAttendance(p) ? { label: 'Attendance Map', meta: 'season heat map', icon: 'ph ph-grid-nine', href: '/dashboard/attendance' } : null,
        canPublishBoard(p) ? { label: 'Parent Board Link', meta: 'read-only', icon: 'ph ph-link', href: '/dashboard/parent-link' } : null,
        { label: 'Races', meta: 'squad pushes · individuals', icon: 'ph ph-target', href: '/dashboard/races' },
        { label: 'Calendar', meta: upcomingEvents(d, p)[0] ? eventLabel(upcomingEvents(d, p)[0]) : 'nothing scheduled', icon: 'ph ph-calendar-dots', href: '/dashboard/calendar' },
        canOpenLibrary(p) ? { label: 'Library', meta: 'search weeks, lessons, games', icon: 'ph ph-magnifying-glass', href: '/dashboard/library' } : null,
        { label: 'Season & Small Groups', meta: d.config.seasonWeeks + ' weeks · ' + d.smallGroups.length + ' guides', icon: 'ph ph-list-checks', href: '/dashboard/season-plan' },
        { label: 'Trophies & Awards', meta: d.awards.filter((a) => a.decidedBy === 'vote' && awardOpen(a, cy.today)).length + ' open for vote', icon: 'ph ph-trophy', href: '/dashboard/awards' }
      ]
    },
    {
      title: 'Oversight',
      visible: canApprove(p),
      items: [
        { label: 'Approval Queue', meta: pendingPts + ' pending', icon: 'ph ph-seal-check', href: '/dashboard/approvals' },
        { label: 'People & Roles', meta: d.roster.length + ' people', icon: 'ph ph-users-three', href: '/console?tab=people' },
        { label: 'Audit Log', meta: 'everything', icon: 'ph ph-list-magnifying-glass', href: '/dashboard/audit' },
        { label: 'Web Dashboard', meta: 'full control', icon: 'ph ph-gauge', href: '/console' },
        { label: 'Planner', meta: 'seven years · seasons · nights', icon: 'ph ph-map-trifold', href: '/planner' },
        canControlEvent(p) ? { label: 'Projector Mode', meta: 'second screen', icon: 'ph ph-projector-screen', href: '/projector' } : null
      ]
    }
  ];

  /* Recent: deep screens opened lately that this role can still open —
     anything it can't (or that no longer exists) quietly drops out. */
  const byHref = new Map(groups.filter((g) => g.visible).flatMap((g) => (g.items.filter(Boolean) as Item[]).filter((it) => it.href).map((it) => [it.href!, it] as const)));
  const recent = recentHrefs.map((h) => byHref.get(h)).filter((x): x is Item => !!x).slice(0, 5);
  const needle = q.trim().toLowerCase();
  const shown = groups
    .filter((g) => g.visible)
    .map((g) => ({
      ...g,
      items: (g.items.filter(Boolean) as Item[]).filter((it) => !needle || (it.label + ' ' + it.meta + ' ' + g.title).toLowerCase().includes(needle))
    }))
    .filter((g) => g.items.length);

  return (
    <Screen label="More menu">
      <h1 className="text-[25px] font-medium leading-[1.15] text-neutral-100">More</h1>
      <button
        onClick={() => setInvite(true)}
        className="flex min-h-11 items-center gap-[11px] rounded-lg border border-accent-600 px-[14px] py-[13px] text-left"
        style={{ background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)' }}
      >
        <Icon name="ph ph-qr-code" className="flex-none text-[20px] text-accent-300" />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-medium leading-[1.2] text-neutral-100">Invite someone</div>
          <div className="mt-[3px] text-[11px] leading-[1.4] text-neutral-500">QR code or a link — join the season or just come cheer</div>
        </div>
        <Icon name="ph ph-arrow-right" className="flex-none text-[14px] text-accent-300" />
      </button>
      <div className="relative flex items-center">
        <Icon name="ph ph-magnifying-glass" className="pointer-events-none absolute left-[13px] text-[15px] text-neutral-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search everything"
          aria-label="Search everything"
          className="min-h-11 w-full rounded-lg border border-neutral-800 bg-surface pl-9 pr-[38px] text-[13.5px] text-neutral-100 placeholder:text-neutral-500 focus:border-accent-600 focus:outline-none"
        />
        {q ? (
          <button aria-label="Clear search" onClick={() => setQ('')} className="absolute right-0 flex h-11 w-11 items-center justify-center rounded-full text-neutral-400">
            <Icon name="ph ph-x" className="text-[14px]" />
          </button>
        ) : null}
      </div>
      {!needle && recent.length >= 2 ? (
        <div>
          <div className="mb-[9px] mt-[2px] text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Recent</div>
          <div className="-mx-1 flex gap-[7px] overflow-x-auto px-1 pb-[2px]" style={{ scrollbarWidth: 'none' }}>
            {recent.map((it) => (
              <Link key={it.href} href={it.href!} className="flex min-h-11 flex-none items-center gap-[7px] rounded-full border border-neutral-800 px-[13px] text-[12.5px] font-medium text-neutral-200">
                <Icon name={it.icon} className="text-[14px] text-accent-300" />
                {it.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      {needle && !shown.length ? (
        <div className="rounded-lg bg-surface px-4 py-[22px] text-center text-[12.5px] leading-[1.5] text-neutral-500 text-pretty">
          Nothing here matches that. Try a shorter word — squads, points, prayer, film.
        </div>
      ) : null}
      {shown.map((g) => (
        <div key={g.title}>
          <div className="mb-[9px] mt-[6px] text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">{g.title}</div>
          <div className="sr-card overflow-hidden">
            {g.items.map((it, i) => {
              const inner = (
                <>
                  <Icon name={it.icon} className="flex-none text-[18px] text-accent-400" />
                  <span className="flex-1 text-[13.5px] font-medium leading-[1.3] text-neutral-200">{it.label}</span>
                  <span className="max-w-[56%] truncate text-right text-[11.5px] leading-none text-neutral-500">{it.meta}</span>
                  <Icon name="ph ph-caret-right" className="flex-none text-[13px] text-neutral-600" />
                </>
              );
              const cls = 'flex min-h-[52px] w-full items-center gap-3 px-[15px] py-3 text-left sr-hover' + (i ? ' border-t border-divider' : '');
              return it.href ? (
                <Link key={it.label} href={it.href} onClick={it.onClick} className={cls} style={{ color: 'inherit' }}>
                  {inner}
                </Link>
              ) : (
                <button key={it.label} onClick={it.onClick} className={cls}>
                  {inner}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="text-[10.5px] leading-[1.5] text-neutral-500 text-pretty">
        Signed in as {personaDef(p).label} · {d.config.ministryName}. Tap the avatar on Home to switch roles.
      </div>
      <InviteSheet open={invite} onClose={() => setInvite(false)} />
    </Screen>
  );
}
