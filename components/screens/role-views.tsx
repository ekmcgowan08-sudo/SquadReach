'use client';
/* SIX ROLE VIEWS, ONE SCREEN EACH. Every role has a screen that is ITS
   screen, not a filtered version of someone else's. Access reads the
   domain.ts constants through canOpenRoleView(); a leader opening someone
   else's view is PREVIEWING, and the strip says so. */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { InviteSheet } from '@/components/dashboard/invite-sheet';
import { useStandings } from '@/components/dashboard/standings-list';
import { Btn, Icon, PreviewStrip, Screen, ScreenHeader } from '@/components/ui';
import { ago } from '@/lib/dates';
import { autoApproves, canEditRoster, canScore, canSwitchTeamView, isPreviewing } from '@/lib/permissions';
import { deltaLabel, fmt, studentTotal } from '@/lib/scoring';
import { bibleStats } from '@/lib/bible';
import { catOf, eventVisible, myTeamId, teamMetaLabel, teamOf, teamRoster } from '@/lib/selectors';
import { useApp, useAppApi } from '@/lib/store/provider';
import { personaDef } from '@/lib/types/domain';
import type { MinistryEvent } from '@/lib/types/model';

const RSVP_FG: Record<string, string> = { going: '#8fd8b0', maybe: '#e3c98d', out: '#e0a3a3' };
const RSVP_LABEL: Record<string, string> = { going: 'Going', maybe: 'Maybe', out: 'Can’t' };

function useMyRsvpName() {
  const m = useApp((s) => s.membership);
  return m.persona === 'member' || m.persona === 'captain' ? m.studentName ?? m.displayName : m.displayName;
}

function EventRow({ e }: { e: MinistryEvent }) {
  const rsvps = useApp((s) => s.data.rsvps);
  const me = useMyRsvpName();
  const mine = rsvps[e.id]?.[me];
  return (
    <Link href={'/dashboard/events/' + e.id} className="flex min-h-11 w-full items-center gap-[11px] rounded-lg bg-surface px-[13px] py-3 text-left shadow-sm sr-hover" style={{ color: 'inherit' }}>
      <div className="w-[3px] flex-none self-stretch rounded-sm" style={{ background: e.color }} />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium leading-[1.3] text-neutral-100 text-pretty">{e.title}</div>
        <div className="mt-1 text-[10.5px] leading-[1.3] text-neutral-500">{e.meta}</div>
        <div className="mt-[7px] text-[10px] font-medium leading-none" style={{ color: mine ? RSVP_FG[mine.status] : 'var(--color-accent-300)' }}>
          {mine ? 'You: ' + RSVP_LABEL[mine.status] + (mine.heldAt ? ' · held' : '') : 'Tap to say if you’re coming'}
        </div>
      </div>
      <div className="flex flex-none flex-col items-end gap-[7px]">
        <span className="text-[11px] font-medium leading-none text-neutral-300">{e.date}</span>
        <Icon name="ph ph-caret-right" className="text-[12px] text-neutral-600" />
      </div>
    </Link>
  );
}

/* ── TEAM VIEW — one squad's page; replaces the old My Team screen ─────── */
export function TeamViewScreen({ teamId: forced }: { teamId?: string }) {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const coachTeam = useApp((s) => s.coachTeam);
  const router = useRouter();
  const rows = useStandings();
  const canSwitch = canSwitchTeamView(m.persona);
  const mine = myTeamId(m, d, coachTeam);
  const [picked, setPicked] = useState<string | null>(forced ?? null);
  const viewId = canSwitch ? picked ?? mine : mine;
  const t = teamOf(d, viewId);
  const row = rows.find((r) => r.id === viewId);
  const roster = teamRoster(d, viewId);
  const showPresence = canEditRoster(m.persona);
  const pending = d.ledger.filter((e) => e.status === 'pending' && e.team === viewId);
  const segs = row?.segs.filter((s) => s.pct > 0) ?? [];
  const live = autoApproves(m.persona);
  return (
    <Screen label="Team view" gap={13}>
      <ScreenHeader title="Team view" />
      {canSwitch ? (
        <div className="flex gap-[6px] overflow-x-auto pb-[2px]">
          {d.teams.map((x) => {
            const on = x.id === viewId;
            return (
              <button
                key={x.id}
                onClick={() => setPicked(x.id)}
                aria-pressed={on}
                className="flex min-h-11 flex-none items-center gap-[6px] rounded-full border px-3 text-[12px] font-medium leading-none"
                style={{ borderColor: on ? 'var(--color-accent-500)' : 'var(--color-neutral-800)', background: on ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent', color: on ? 'var(--color-accent-200)' : 'var(--color-neutral-300)' }}
              >
                <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: x.color }} />
                {x.name}
                <span className="tabular text-[10.5px] font-normal leading-none text-neutral-500">{teamRoster(d, x.id).length}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="sr-card relative overflow-hidden px-[15px] py-[14px]">
        <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: t.color }} />
        <div className="flex items-center justify-between gap-[10px]">
          <div className="min-w-0">
            <div className="text-[17px] font-medium leading-[1.2] text-neutral-100">{t.name}</div>
            <div className="mt-1 text-[11px] leading-[1.3] text-neutral-500">{teamMetaLabel(d, viewId)}</div>
          </div>
          <div className="flex-none text-right">
            <div className="tabular text-[18px] font-semibold leading-none text-neutral-100">{fmt(row?.total ?? 0)}</div>
            <div className="mt-[5px] text-[10.5px] leading-none" style={{ color: row?.rank === 1 ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }}>
              #{row?.rank ?? '–'} · {row ? deltaLabel(row) : ''}
            </div>
          </div>
        </div>
        {t.mascotName && t.mascotStory ? (
          <div className="mt-[11px] border-t border-divider pt-[10px]">
            <div className="text-[9.5px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">{t.mascotName}</div>
            <div className="mt-[6px] text-[11.5px] leading-[1.6] text-neutral-400 text-pretty">{t.mascotStory}</div>
          </div>
        ) : null}
      </div>
      {segs.length ? (
        <div className="sr-card flex flex-col gap-[9px] px-[14px] py-[13px]">
          <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Where the points came from</div>
          {segs.map((g) => (
            <div key={g.id} className="flex flex-col gap-[5px]">
              <div className="flex items-baseline gap-2">
                <span className="h-[7px] w-[7px] flex-none rounded-sm" style={{ background: g.color }} />
                <span className="flex-1 text-[11.5px] leading-none text-neutral-300">{g.label}</span>
                <span className="tabular text-[11.5px] font-medium leading-none text-neutral-200">{fmt(g.value)}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-neutral-900">
                <div className="h-full rounded-full" style={{ width: g.pct + '%', background: g.color }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {pending.length ? (
        <div className="flex flex-col gap-2 rounded-lg border border-neutral-800 px-[13px] py-3">
          <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Waiting on approval</div>
          {pending.slice(0, 8).map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <Icon name="ph ph-clock-countdown" className="flex-none text-[12px] text-neutral-500" />
              <span className="flex-1 text-[11.5px] leading-none text-neutral-300">
                +{fmt(p.amount)} {catOf(d, p.cat).label}
              </span>
              <span className="text-[10.5px] leading-none text-neutral-500">from {p.by}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex items-baseline gap-2">
        <div className="flex-1 text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Roster</div>
        <div className="text-[10.5px] leading-none text-neutral-500">{roster.length + (roster.length === 1 ? ' student' : ' students')}</div>
      </div>
      {!roster.length ? (
        <div className="flex flex-col items-start gap-[10px] rounded-lg border border-dashed border-neutral-700 px-4 py-[18px]">
          <Icon name="ph ph-users-three" className="text-[20px] text-neutral-500" />
          <div className="text-[12px] leading-[1.5] text-neutral-500 text-pretty">
            {t.name} has no roster yet. A coach or leader imports it from Planning Center, or adds students one at a time from Coach view.
          </div>
        </div>
      ) : (
        <div className="sr-card overflow-hidden">
          {roster.map((r, i) => {
            const here = !!d.tonight.presence[r.name];
            return (
              <div key={r.id} className={'flex min-h-11 items-center gap-[10px] px-[15px] py-[11px]' + (i ? ' border-t border-divider' : '')}>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium leading-[1.2] text-neutral-200">{r.name}</div>
                  <div className="mt-[3px] text-[10.5px] leading-[1.3] text-neutral-500">{(r.captain ? 'captain · ' : '') + 'grade ' + r.grade}</div>
                </div>
                {showPresence ? (
                  <div className="flex-none text-[10.5px] font-medium leading-none" style={{ color: here ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }}>
                    {here ? 'here' : '—'}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {canScore(m.persona) ? (
        <Btn className="min-h-12 justify-center" onClick={() => router.push('/dashboard/score?team=' + viewId)}>
          Score {t.name}
        </Btn>
      ) : null}
      <div className="text-[10.5px] leading-[1.45] text-neutral-500 text-pretty">
        {canScore(m.persona)
          ? live
            ? 'What you post here lands on the board immediately.'
            : 'What you post here goes to the approval queue.'
          : 'Your role reads the board. Scoring belongs to coaches, the scorekeeper and leaders.'}
      </div>
    </Screen>
  );
}

/* ── CAPTAIN VIEW — who is missing, with a nudge each, and squad pushes ── */
export function CaptainViewScreen() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const coachTeam = useApp((s) => s.coachTeam);
  const offline = useApp((s) => !s.netOnline || s.offlineSim);
  const api = useAppApi();
  const router = useRouter();
  const rows = useStandings();
  const [nudgeFor, setNudgeFor] = useState<string | null>(null);
  const [noPhone, setNoPhone] = useState<Record<string, boolean>>({});
  const [invite, setInvite] = useState(false);
  const myId = myTeamId(m, d, coachTeam);
  const t = teamOf(d, myId);
  const row = rows.find((r) => r.id === myId);
  const roster = teamRoster(d, myId);
  const missing = roster.filter((r) => !d.tonight.presence[r.name]);
  const pushes = d.challenges.filter((c) => !c.team || c.team === myId);
  const earners = useMemo(
    () =>
      roster
        .map((r) => ({ name: r.name, pts: studentTotal(r.name, d.ledger, d.studentSeedPoints) }))
        .filter((r) => r.pts > 0)
        .sort((a, b) => b.pts - a.pts)
        .slice(0, 5),
    [roster, d.ledger, d.studentSeedPoints]
  );
  const top = earners[0]?.pts ?? 0;

  /* A nudge is a push notification, so it has no outbox — offline it simply
     cannot go, and says so rather than pretending to queue. */
  const reach = (name: string, how: 'push' | 'parent' | 'find') => {
    const first = name.split(' ')[0];
    setNudgeFor(null);
    if (how === 'find') {
      api().logActivity('Going to find ' + name + ' in person');
      api().say('On your list. Nothing was sent — go get them.');
      return;
    }
    if (offline) {
      api().say('No signal — that message needs a connection. "Go find them" still works.');
      return;
    }
    if (how === 'parent') {
      api().logActivity('Texted ' + name + '’s household about tonight');
      api().say('Text sent to ' + first + '’s household.');
      return;
    }
    api().logActivity('Nudged ' + name + ' about tonight');
    api().say(first + ' got a push notification.');
  };

  return (
    <Screen label="Captain view" gap={13}>
      <ScreenHeader title="Captain view" />
      {isPreviewing(m.persona, 'captain') ? <PreviewStrip>Previewing what a captain sees. Switch roles from the avatar on Home to hold it for real.</PreviewStrip> : null}
      <div className="sr-card flex items-center gap-3 p-[14px]">
        <div className="h-[38px] w-[10px] flex-none rounded-[3px]" style={{ background: t.color }} />
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-medium leading-[1.2] text-neutral-100">{t.name}</div>
          <div className="mt-1 text-[11px] leading-[1.3]" style={{ color: row?.rank === 1 ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }}>
            #{row?.rank ?? '–'} · {row ? deltaLabel(row) : ''}
          </div>
        </div>
        <div className="tabular flex-none text-[20px] font-semibold leading-none text-neutral-100">{fmt(row?.total ?? 0)}</div>
      </div>
      <div className="sr-card flex flex-col gap-[10px] px-[14px] py-[13px]">
        <div className="flex items-baseline gap-2">
          <div className="flex-1 text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Who is here</div>
          <div className="tabular text-[11.5px] font-medium leading-none text-neutral-200">
            {roster.length - missing.length} / {roster.length}
          </div>
        </div>
        <div className="text-[11px] leading-[1.45] text-neutral-500 text-pretty">
          {missing.length ? missing.length + ' not here yet' : 'everyone in'} · marking attendance belongs to your coach. Chasing people is yours.
        </div>
        {missing.length ? (
          <>
            <div className="flex flex-col gap-[6px]">
              {missing.slice(0, 8).map((r) => {
                const np = !!noPhone[r.name];
                const first = r.name.split(' ')[0];
                const open = nudgeFor === r.name;
                const options = [
                  np ? null : { label: 'Push to their phone', hint: 'Lands in a second, if they have signal', icon: 'ph ph-bell-ringing', go: () => reach(r.name, 'push') },
                  { label: 'Text whoever brings them', hint: 'Goes to the guardians on their household', icon: 'ph ph-chat-circle-text', go: () => reach(r.name, 'parent') },
                  { label: 'Go find them', hint: 'Puts it on your list — no notification sent', icon: 'ph ph-footprints', go: () => reach(r.name, 'find') },
                  np
                    ? { label: first + ' does have a phone', hint: 'Puts the push option back', icon: 'ph ph-arrow-counter-clockwise', go: () => { setNoPhone((x) => ({ ...x, [r.name]: false })); api().say('Push is back on for ' + first + '.'); } }
                    : { label: 'No phone — remember that', hint: 'Stops offering a push for ' + first, icon: 'ph ph-device-mobile-slash', go: () => { setNoPhone((x) => ({ ...x, [r.name]: true })); api().say('Noted — no push for ' + first + '.'); } }
                ].filter(Boolean) as { label: string; hint: string; icon: string; go: () => void }[];
                return (
                  <div key={r.id}>
                    <div className="flex min-h-11 items-center gap-[9px]">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-medium leading-[1.2] text-neutral-200">{r.name}</div>
                        <div className="mt-[3px] text-[10.5px] leading-[1.3] text-neutral-500">{(r.captain ? 'captain · ' : '') + 'grade ' + r.grade + (np ? ' · no phone' : '')}</div>
                      </div>
                      <Btn variant="ghost" className="flex-none px-3" onClick={() => setNudgeFor(open ? null : r.name)}>
                        {open ? 'Close' : np ? 'Reach them' : 'Nudge'}
                      </Btn>
                    </div>
                    {open ? (
                      <div className="-mt-[2px] mb-[6px] flex flex-col gap-[6px] rounded-md border border-neutral-800 bg-neutral-900 p-[11px]">
                        <div className="text-[10.5px] leading-[1.45] text-neutral-500 text-pretty">
                          {np ? first + ' does not carry a phone, so a push will not land. These two will.' : 'A nudge is a push to their own phone. If they do not carry one, use one of the others.'}
                        </div>
                        {options.map((o) => (
                          <button key={o.label} onClick={o.go} className="flex min-h-11 items-center gap-[9px] rounded-md border border-neutral-800 px-[11px] text-left hover:border-accent-600">
                            <Icon name={o.icon} className="flex-none text-[15px] text-accent-300" />
                            <div className="min-w-0 flex-1">
                              <div className="text-[11.5px] font-medium leading-[1.25] text-neutral-200">{o.label}</div>
                              <div className="mt-[2px] text-[10px] leading-[1.35] text-neutral-500">{o.hint}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <Btn variant="secondary" className="justify-center" onClick={() => setInvite(true)}>
              <Icon name="ph ph-paper-plane-tilt" className="text-[14px]" />
              Send the squad a link
            </Btn>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Icon name="ph-fill ph-check-circle" className="flex-none text-[15px] text-accent-300" />
            <div className="text-[11.5px] leading-[1.4] text-neutral-300">Everyone on your squad is marked here.</div>
          </div>
        )}
      </div>
      <div className="sr-card flex flex-col gap-[10px] px-[14px] py-[13px]">
        <div className="flex items-baseline gap-2">
          <div className="flex-1 text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Who is carrying the squad</div>
          <div className="text-[11.5px] font-medium leading-none text-accent-200">this season</div>
        </div>
        {earners.length ? (
          <>
            <div className="flex flex-col gap-[7px]">
              {earners.map((e, i) => (
                <div key={e.name} className="flex min-h-11 items-center gap-[10px]">
                  <div className="tabular w-5 flex-none text-[12px] font-semibold leading-none text-neutral-500">{i + 1}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium leading-[1.2] text-neutral-200">{e.name}</div>
                    <div className="mt-[6px] h-1 overflow-hidden rounded-sm bg-neutral-800">
                      <div className="h-full" style={{ width: (top ? Math.max(4, Math.round((e.pts / top) * 100)) : 0) + '%', background: t.color }} />
                    </div>
                  </div>
                  <div className="tabular flex-none text-[13px] font-semibold leading-none text-neutral-100">{fmt(e.pts)}</div>
                </div>
              ))}
            </div>
            <div className="text-[10.5px] leading-[1.5] text-neutral-500 text-pretty">
              {earners[0].name.split(' ')[0]} is putting the most on the board. Worth a word tonight — and worth asking who they could bring next week.
            </div>
          </>
        ) : (
          <div className="text-[11.5px] leading-[1.5] text-neutral-400 text-pretty">Nobody on your squad has earned points yet. Once check-in starts, the names show up here.</div>
        )}
      </div>
      {pushes.length ? (
        <>
          <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Squad pushes</div>
          <div className="flex flex-col gap-[7px]">
            {pushes.map((p) => (
              <div key={p.id} className="sr-card relative overflow-hidden px-[13px] py-3">
                <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: p.done ? 'var(--color-accent-500)' : 'var(--color-neutral-700)' }} />
                <div className="text-[13px] font-medium leading-[1.3] text-neutral-100 text-pretty">{p.title}</div>
                <div className="mt-[7px] flex items-baseline gap-2">
                  <div className="flex-1 text-[11px] leading-none" style={{ color: p.done ? 'var(--color-accent-300)' : 'var(--color-neutral-400)' }}>
                    {p.status}
                  </div>
                  <div className="tabular text-[11px] font-medium leading-none text-neutral-300">{p.pointsLabel}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
      <div className="flex flex-col gap-[9px] rounded-lg border border-neutral-800 px-[14px] py-[13px]">
        <div className="text-[12.5px] font-medium leading-[1.2] text-neutral-100">Points you spot</div>
        <div className="text-[11px] leading-[1.5] text-neutral-500 text-pretty">
          {autoApproves(m.persona) ? 'Your role posts straight to the board.' : 'What you submit lands in the approval queue for a leader to clear — captains are not in AUTO_APPROVE_ROLES.'}
        </div>
        <Btn className="justify-center" onClick={() => router.push('/dashboard/submit-points')}>
          Submit points with proof
        </Btn>
        <Btn variant="ghost" className="justify-center" onClick={() => router.push('/dashboard/team')}>
          Open the squad page
        </Btn>
      </div>
      <InviteSheet open={invite} onClose={() => setInvite(false)} />
    </Screen>
  );
}

/* ── ADMIN VIEW — the owner's phone. The console does the long work. ───── */
export function AdminViewScreen() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const pend = d.accessRequests.filter((r) => r.status === 'pending');
  const pendingPts = new Set(d.ledger.filter((e) => e.status === 'pending').map((e) => e.batch ?? e.id)).size;
  return (
    <Screen label="Admin view" gap={13}>
      <ScreenHeader title="Admin view" sub={d.config.ministryName} />
      {isPreviewing(m.persona, 'admin') ? <PreviewStrip>Previewing the owner’s phone. Approvals here are real — they write to the audit log with your name.</PreviewStrip> : null}
      <div className="flex gap-2">
        {[
          { label: 'People', value: String(d.roster.length), hint: 'on the roster' },
          { label: 'Squads', value: String(d.teams.length), hint: 'this season' },
          { label: 'Season', value: String(d.config.seasonWeeks), hint: 'weeks' }
        ].map((st) => (
          <div key={st.label} className="flex-1 rounded-md bg-neutral-900 px-[11px] py-[10px]">
            <div className="text-[9.5px] uppercase leading-none tracking-[.08em] text-neutral-500">{st.label}</div>
            <div className="tabular mt-[7px] text-[17px] font-semibold leading-none text-neutral-100">{st.value}</div>
            <div className="mt-[5px] text-[10px] leading-none text-neutral-500">{st.hint}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-neutral-700 px-[14px] py-[13px]">
        <div className="flex items-center gap-[9px]">
          <Icon name="ph ph-plugs-connected" className="flex-none text-[15px] text-accent-300" />
          <div className="flex-1 text-[12.5px] font-medium leading-[1.2] text-neutral-200">Planning Center not connected</div>
        </div>
        <div className="text-[11px] leading-[1.5] text-neutral-500 text-pretty">Until this is connected nobody new can be verified, and every access request has to be judged by hand.</div>
        <Btn variant="ghost" className="justify-center" href="/console?tab=people">
          Open People &amp; roles
        </Btn>
      </div>
      <div className="sr-card flex flex-col gap-[10px] px-[14px] py-[13px]">
        <div className="flex items-baseline gap-2">
          <div className="flex-1 text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Access requests</div>
          <div className="text-[11px] font-medium leading-none text-neutral-200">{pend.length + (pend.length === 1 ? ' person waiting' : ' people waiting')}</div>
        </div>
        {!pend.length ? <div className="text-[11.5px] leading-[1.45] text-neutral-500 text-pretty">Nothing waiting. A requested tier stays inert until someone with leader access approves it.</div> : null}
        {pend.slice(0, 4).map((q) => (
          <AccessRow key={q.id} id={q.id} />
        ))}
      </div>
      <Link href="/dashboard/approvals" className="flex min-h-12 items-center gap-[11px] rounded-lg border border-neutral-800 px-[13px] text-left hover:border-accent-600" style={{ color: 'inherit' }}>
        <Icon name="ph ph-seal-check" className="flex-none text-[16px] text-accent-300" />
        <div className="min-w-0 flex-1 text-[12.5px] font-medium leading-[1.3] text-neutral-200">{pendingPts + (pendingPts === 1 ? ' point request pending' : ' point requests pending')}</div>
        <Icon name="ph ph-arrow-right" className="flex-none text-[14px] text-neutral-500" />
      </Link>
      {d.activityLog.length ? (
        <div className="sr-card flex flex-col gap-[9px] px-[14px] py-[13px]">
          <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Audit log</div>
          {d.activityLog.slice(0, 5).map((l) => (
            <div key={l.id} className="flex items-baseline gap-[9px]">
              <div className="flex-1 text-[11.5px] leading-[1.45] text-neutral-300 text-pretty">{l.line}</div>
              <div className="flex-none text-[10px] leading-none text-neutral-500">{ago(l.at)}</div>
            </div>
          ))}
        </div>
      ) : null}
      <Btn className="min-h-12 justify-center" href="/console">
        Open the web console
      </Btn>
      <div className="text-[10.5px] leading-[1.45] text-neutral-500 text-pretty">Season setup, permissions, reports and exports live on the console. This screen is what should not wait for a laptop.</div>
    </Screen>
  );
}

/** One access request, with Approve / Deny inline. Approving grants the role. */
export function AccessRow({ id }: { id: string }) {
  const d = useApp((s) => s.data);
  const api = useAppApi();
  const q = d.accessRequests.find((r) => r.id === id);
  if (!q) return null;
  const decide = (approve: boolean) => {
    if (approve && q.requestedRole === 'parent' && api().membership.mode === 'supabase') {
      api().say('Parent is not a role the database has yet — see the open decisions in the README.');
      return;
    }
    api().mutate((x) => {
      const r = x.accessRequests.find((y) => y.id === id);
      if (r) r.status = approve ? 'approved' : 'denied';
    });
    api().emit({ kind: 'accessDecide', request: q, approve });
    api().logActivity((approve ? 'Approved ' : 'Denied ') + q.name + ' as ' + personaDef(q.requestedRole).label);
    api().say(approve ? q.name + ' is in as ' + personaDef(q.requestedRole).label + '.' : 'Denied. ' + q.name + ' was told.');
  };
  return (
    <div className="flex flex-col gap-2 border-t border-divider pt-[9px]">
      <div>
        <div className="text-[13px] font-medium leading-[1.2] text-neutral-100">{q.name}</div>
        <div className="mt-1 text-[10.5px] leading-[1.3] text-neutral-500">
          wants {personaDef(q.requestedRole).label} · {q.household}
        </div>
      </div>
      {q.flagged ? (
        <div className="flex items-start gap-[7px]">
          <Icon name="ph ph-warning" className="mt-[1px] flex-none text-[13px] text-accent-300" />
          <div className="text-[10.5px] leading-[1.4] text-neutral-300 text-pretty">Parent link unconfirmed — verify the household before approving.</div>
        </div>
      ) : null}
      <div className="flex gap-2">
        <Btn variant="ghost" className="flex-1 justify-center" onClick={() => decide(false)}>
          Deny
        </Btn>
        <Btn className="flex-[2] justify-center" onClick={() => decide(true)}>
          Approve
        </Btn>
      </div>
    </div>
  );
}

/* ── PARENT VIEW — one household, read-only. A proposal persona. ───────── */
export function ParentViewScreen() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const rows = useStandings();
  const [watch, setWatch] = useState(m.studentName ?? d.studentBadges[0]?.name ?? d.roster[0]?.name ?? '');
  const kid = d.roster.find((r) => r.name === watch) ?? d.roster[0];
  const t = teamOf(d, kid?.team);
  const row = rows.find((r) => r.id === kid?.team);
  const events = d.events.filter((e) => e.roles.includes('parents')).slice(0, 3);
  const here = kid ? !!d.tonight.presence[kid.name] : false;
  const badge = d.studentBadges.find((b) => b.name === kid?.name);
  const kidBible = bibleStats(d.practiceLog.filter((r) => r.who === kid?.name), d.config.memoryVerses, d.config.weekNumber);
  const board = (typeof window !== 'undefined' ? window.location.host : 'squadrise.app') + '/b/' + d.config.parentCode;
  if (!kid) return null;
  return (
    <Screen label="Parent view" gap={13}>
      <ScreenHeader title="Parent view" />
      {isPreviewing(m.persona, 'parent') ? <PreviewStrip>Previewing a parent’s phone — useful before you tell a family what they will see.</PreviewStrip> : null}
      <div className="field">
        <label htmlFor="watch">Your student</label>
        <select id="watch" value={watch} onChange={(e) => setWatch(e.target.value)} className="input" disabled={m.persona === 'parent'}>
          {(m.persona === 'parent' ? d.roster.filter((r) => r.name === m.studentName) : d.roster).map((r) => (
            <option key={r.id} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sr-card relative overflow-hidden px-[15px] py-[14px]">
        <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: t.color }} />
        <div className="flex items-start justify-between gap-[10px]">
          <div className="min-w-0">
            <div className="text-[17px] font-medium leading-[1.2] text-neutral-100">{kid.name}</div>
            <div className="mt-1 text-[11px] leading-[1.3] text-neutral-500">
              grade {kid.grade} · {t.name} · squad #{row?.rank ?? '–'} · {fmt(row?.total ?? 0)} squad pts
            </div>
          </div>
          <div className="flex-none rounded-full border px-[10px] py-[7px] text-[10.5px] font-medium leading-none" style={{ borderColor: here ? 'var(--color-accent-600)' : 'var(--color-neutral-700)', color: here ? 'var(--color-accent-200)' : 'var(--color-neutral-200)' }}>
            {here ? 'Checked in tonight' : 'Not checked in yet'}
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          {[
            { label: 'Verses due', value: String(kidBible.due), hint: 'this week' },
            { label: 'Streak', value: String(Math.max(kidBible.streak, badge?.bibleStreak ?? 0)), hint: 'days' }
          ].map((st) => (
            <div key={st.label} className="flex-1 rounded-md bg-neutral-900 px-[11px] py-[10px]">
              <div className="text-[9.5px] uppercase leading-none tracking-[.08em] text-neutral-500">{st.label}</div>
              <div className="tabular mt-[7px] text-[17px] font-semibold leading-none text-neutral-100">{st.value}</div>
              <div className="mt-[5px] text-[10px] leading-none text-neutral-500">{st.hint}</div>
            </div>
          ))}
        </div>
      </div>
      {events.length ? (
        <>
          <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">What your family needs to know</div>
          <div className="flex flex-col gap-[7px]">
            {events.map((e) => (
              <EventRow key={e.id} e={e} />
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-start gap-[9px] rounded-lg border border-dashed border-neutral-700 px-4 py-[18px]">
          <Icon name="ph ph-calendar-dots" className="text-[20px] text-neutral-500" />
          <div className="text-[12px] leading-[1.5] text-neutral-500 text-pretty">Nothing has been shared with families yet. Leaders choose which events parents see when they publish them.</div>
        </div>
      )}
      <div className="flex flex-col gap-[9px] rounded-lg border border-neutral-800 px-[14px] py-[13px]">
        <div className="text-[12.5px] font-medium leading-[1.2] text-neutral-100">Read-only board</div>
        <div className="text-[11px] leading-[1.5] text-neutral-500 text-pretty">{board} — standings and the memory verse, no login needed. Share it with grandparents.</div>
        <div className="flex gap-2">
          <Btn
            variant="secondary"
            className="flex-1 justify-center"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText('https://' + board);
                api().say('Board link copied.');
              } catch {
                api().say('Copy failed — long-press the link instead.');
              }
            }}
          >
            Copy the link
          </Btn>
          <Btn variant="ghost" className="flex-1 justify-center" href="/dashboard/follow-ups">
            Send a prayer request
          </Btn>
        </div>
      </div>
      <div className="flex flex-col gap-2 rounded-lg bg-neutral-900 px-[14px] py-[13px]">
        <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">What a parent never sees</div>
        {['Other students and other households', 'The squad roster and the attendance sheet', 'Team care notes, and anyone else’s prayer request', 'Anything that scores, approves or edits'].map((w) => (
          <div key={w} className="flex items-start gap-2">
            <Icon name="ph ph-minus-circle" className="mt-[2px] flex-none text-[12px] text-neutral-500" />
            <div className="text-[11px] leading-[1.45] text-neutral-400 text-pretty">{w}</div>
          </div>
        ))}
        <div className="mt-[2px] text-[10.5px] leading-[1.45] text-neutral-500 text-pretty">
          Parent is a prototype-only tier: the schema has no MembershipRole for it, so the household record has to do the gating.
        </div>
      </div>
    </Screen>
  );
}

/* ── CONGREGATION VIEW — the public board. Read-only end to end. ───────── */
export function CongregationViewScreen() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const rows = useStandings();
  const [invite, setInvite] = useState(false);
  const events = d.events.filter((e) => eventVisible(e, 'congregation')).slice(0, 3);
  return (
    <Screen label="Congregation view" gap={13}>
      <ScreenHeader title="Congregation view" />
      {isPreviewing(m.persona, 'congregation') ? <PreviewStrip>Previewing the board the wider church sees.</PreviewStrip> : null}
      <div className="sr-card flex flex-col gap-[11px] px-[14px] py-[13px]">
        <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Where the squads stand</div>
        {rows.map((r) => (
          <div key={r.id} className="flex flex-col gap-[6px]">
            <div className="flex items-baseline gap-[9px]">
              <span className="tabular flex-none text-[11px] font-medium leading-none text-neutral-500">#{r.rank}</span>
              <span className="flex-1 text-[13px] font-medium leading-none text-neutral-100">{r.name}</span>
              <span className="tabular text-[13px] font-semibold leading-none text-neutral-100">{fmt(r.total)}</span>
            </div>
            <div className="h-[5px] overflow-hidden rounded-full bg-neutral-900">
              <div className="h-full rounded-full" style={{ width: r.barPct + '%', background: r.color }} />
            </div>
            <div className="text-[10px] leading-none" style={{ color: r.rank === 1 ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }}>
              {deltaLabel(r)}
            </div>
          </div>
        ))}
      </div>
      {events.length ? (
        <>
          <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Open to the whole church</div>
          <div className="flex flex-col gap-[7px]">
            {events.map((e) => (
              <EventRow key={e.id} e={e} />
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-start gap-[9px] rounded-lg border border-dashed border-neutral-700 px-4 py-[18px]">
          <Icon name="ph ph-calendar-dots" className="text-[20px] text-neutral-500" />
          <div className="text-[12px] leading-[1.5] text-neutral-500 text-pretty">No event is open to the whole church right now.</div>
        </div>
      )}
      <div className="flex gap-2">
        <Btn className="min-h-[46px] flex-1 justify-center" href="/dashboard/follow-ups">
          Pray for a student
        </Btn>
        <Btn variant="secondary" className="min-h-[46px] flex-1 justify-center" onClick={() => setInvite(true)}>
          Invite someone
        </Btn>
      </div>
      <div className="text-[10.5px] leading-[1.45] text-neutral-500">{d.prayers.length} requests on the wall · nothing on the wall carries a last name unless the student put it there.</div>
      <div className="rounded-lg bg-neutral-900 px-[14px] py-[13px]">
        <div className="text-[11px] leading-[1.5] text-neutral-400 text-pretty">
          Congregation is a prototype-only tier — the schema has no MembershipRole for it. Read-only by design: squad totals, open events, the prayer wall. No names, no rosters, no student detail.
        </div>
      </div>
      <InviteSheet open={invite} onClose={() => setInvite(false)} initialMode="support" />
    </Screen>
  );
}
