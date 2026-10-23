'use client';
/* CALENDAR + EVENT DETAIL. Coaches, captains and scorekeepers propose; a
   leader approves and decides who sees it. An event's RSVPs are counted for
   everyone, named only for the volunteer set. */
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Sheet } from '@/components/sheet';
import { Btn, Icon, Screen, ScreenHeader, initialsOf } from '@/components/ui';
import { isoDay } from '@/lib/dates';
import { canApprove } from '@/lib/permissions';
import { ALL_AUDIENCES, canRsvp, canSeeRsvpNames, eventLabel, practiceName, rsvpTally, teamOf, upcomingEvents } from '@/lib/selectors';
import { sendChat, sendRsvp } from '@/lib/store/actions';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import { realRole, roleIn } from '@/lib/types/domain';
import type { AudienceId, MinistryEvent, Rsvp } from '@/lib/types/model';

export const AUDIENCE_LABELS: Record<AudienceId, { label: string; hint: string }> = {
  members: { label: 'Students', hint: 'every squad' },
  captains: { label: 'Captains', hint: 'squad leaders' },
  coaches: { label: 'Coaches', hint: 'adult volunteers' },
  scorekeeper: { label: 'Scorekeeper', hint: 'the ledger' },
  leaders: { label: 'Leaders', hint: 'youth pastor + staff' },
  parents: { label: 'Parents', hint: 'household view' },
  admins: { label: 'Org admins', hint: 'the church office' }
};
export const audienceLabel = (roles: AudienceId[]) =>
  roles.length === ALL_AUDIENCES.length ? 'Everyone' : roles.map((r) => AUDIENCE_LABELS[r].label).join(', ') || 'Nobody yet';
const audienceIcon = (roles: AudienceId[]) => (roles.length === ALL_AUDIENCES.length ? 'ph ph-globe-hemisphere-west' : roles.includes('members') ? 'ph ph-users-three' : 'ph ph-lock-simple');

const RSVP_STATUSES: { id: Rsvp['status']; label: string; icon: string; fg: string }[] = [
  { id: 'going', label: 'Going', icon: 'ph-fill ph-check-circle', fg: '#8fd8b0' },
  { id: 'maybe', label: 'Maybe', icon: 'ph ph-question', fg: '#e3c98d' },
  { id: 'out', label: 'Can’t', icon: 'ph ph-x-circle', fg: '#e0a3a3' }
];
const kicker = 'text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500';

export function CalendarScreen() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const p = m.persona;
  const leader = canApprove(p);
  const canPropose = leader || roleIn(realRole(p), ['coach', 'captain', 'scorekeeper']);
  const [composer, setComposer] = useState(false);
  const [review, setReview] = useState<MinistryEvent | null>(null);
  const today = isoDay(new Date());
  const [month, setMonth] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const events = upcomingEvents(d, p, today);
  const me = practiceName(m);
  const proposals = d.events.filter((e) => e.status === 'proposed' && (leader || (e.by ?? '').startsWith(me)));

  const cells = useMemo(() => {
    const first = month.getDay();
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const visible = d.events.filter((e) => e.status !== 'proposed' && e.iso);
    return Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, i) => {
      const day = i - first + 1;
      if (day < 1 || day > days) return null;
      const iso = isoDay(new Date(month.getFullYear(), month.getMonth(), day));
      const ev = visible.find((e) => e.iso === iso && (leader || upcomingEvents(d, p, '0000').includes(e)));
      return { day, iso, ev, meeting: d.config.meetingDates.includes(iso) };
    });
  }, [month, d, p, leader]);

  const decline = (e: MinistryEvent) => {
    api().mutate((x) => void (x.events = x.events.filter((y) => y.id !== e.id)));
    api().emit({ kind: 'eventRemove', id: e.id });
    api().logActivity('Declined the proposed event “' + e.title + '”');
    api().say('Declined. ' + (e.by?.split(' · ')[0] ?? 'They') + ' will see it’s off.');
  };

  return (
    <Screen label="Calendar">
      <ScreenHeader
        title="Calendar"
        back="/dashboard/more"
        right={
          canPropose ? (
            <button onClick={() => setComposer(true)} className="min-h-11 rounded-full border border-accent-600 bg-transparent px-[13px] text-[12.5px] font-semibold leading-none text-accent-200">
              ＋ Event
            </button>
          ) : undefined
        }
      />
      <div className="text-[11px] leading-[1.5] text-neutral-500">
        {leader ? 'Coaches, captains and scorekeepers can propose. You and the org admins approve, and you decide who sees it.' : canPropose ? 'You can propose an event. A leader approves it and decides who sees it.' : 'Everything your ministry has planned for you.'}
      </div>

      {proposals.length ? (
        <div className="flex flex-col gap-[8.4px]">
          <div className={kicker}>Proposed · {proposals.length}</div>
          {proposals.map((e) => (
            <div key={e.id} className="sr-card animate-[sr-rise_.25s_ease_both] px-[15px] py-[16.8px]">
              <div className="flex items-center gap-2">
                <Icon name="ph ph-clock-countdown" className="text-[14px] text-neutral-500" />
                <span className="text-[11px] leading-none text-neutral-500">{e.by}</span>
                <span className="ml-auto text-[11px] font-semibold leading-none text-neutral-300">{eventLabel(e)}</span>
              </div>
              <div className="mt-[11.2px] text-[14px] font-medium leading-[1.3] text-neutral-100">{e.title}</div>
              <div className="mt-1 text-[11.5px] leading-[1.4] text-neutral-500">{e.meta}</div>
              {leader ? (
                <div className="mt-[16.8px] flex gap-[8.4px]">
                  <Btn variant="ghost" className="flex-1 justify-center" onClick={() => decline(e)}>
                    Decline
                  </Btn>
                  <Btn className="flex-[2] justify-center" onClick={() => setReview(e)}>
                    Approve &amp; set who sees it
                  </Btn>
                </div>
              ) : (
                <div className="mt-[11.2px] text-[11px] leading-[1.4] text-neutral-500">Waiting on a leader to review.</div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      <div className="sr-card px-[13px] pb-[15px] pt-[14px]">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex-1 text-[13.5px] font-medium leading-none text-neutral-100">{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
          <button aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-400">
            <Icon name="ph ph-caret-left" className="text-[13px]" />
          </button>
          <button aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-400">
            <Icon name="ph ph-caret-right" className="text-[13px]" />
          </button>
        </div>
        <div className="mb-[6px] grid grid-cols-7 gap-[5px]">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x, i) => (
            <div key={i} className="text-center text-[9.5px] font-medium leading-none text-neutral-600">
              {x}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-[5px]">
          {cells.map((c, i) =>
            c ? (
              <Link
                key={i}
                href={c.ev ? '/dashboard/events/' + c.ev.id : '#'}
                aria-label={c.ev ? c.ev.title + ', ' + eventLabel(c.ev) : String(c.day)}
                onClick={(e) => !c.ev && e.preventDefault()}
                className="flex aspect-square flex-col items-center justify-center gap-[3px] rounded-[6px] text-[11px] font-medium leading-none"
                style={{
                  background: c.iso === today ? 'color-mix(in srgb, var(--color-accent) 22%, transparent)' : c.ev ? 'var(--color-neutral-900)' : 'transparent',
                  color: c.iso < today ? 'var(--color-neutral-600)' : c.iso === today ? 'var(--color-accent-100)' : 'var(--color-neutral-300)',
                  boxShadow: c.meeting ? 'inset 0 0 0 1px var(--color-neutral-700)' : undefined
                }}
              >
                <span>{c.day}</span>
                <span className="h-1 w-1 rounded-full" style={{ background: c.ev ? c.ev.color : 'transparent' }} />
              </Link>
            ) : (
              <div key={i} />
            )
          )}
        </div>
      </div>

      <div className="flex flex-col gap-[9px]">
        {!events.length ? (
          <div className="flex flex-col items-start gap-[9px] rounded-lg border border-dashed border-neutral-700 px-4 py-5">
            <Icon name="ph ph-calendar-dots" className="text-[20px] text-neutral-500" />
            <div className="text-[12px] leading-[1.5] text-neutral-500 text-pretty">Nothing on the calendar for your role yet.{canPropose ? ' Add an event, or approve one that was proposed.' : ''}</div>
          </div>
        ) : null}
        {events.map((e) => {
          const t = rsvpTally(d, e, p);
          const mine = d.rsvps[e.id]?.[me];
          const sd = RSVP_STATUSES.find((x) => x.id === mine?.status);
          return (
            <Link key={e.id} href={'/dashboard/events/' + e.id} className="sr-card sr-hover flex items-stretch gap-3 px-[15px] py-[13px] text-left">
              <div className="w-[3px] flex-none rounded-[2px]" style={{ background: e.color }} />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium leading-[1.2] text-neutral-100">{e.title}</div>
                <div className="mt-1 text-[11.5px] leading-[1.4] text-neutral-500">{e.meta}</div>
                <div className="mt-[7px] flex items-center gap-[5px]">
                  <Icon name={audienceIcon(e.roles)} className="text-[12px] text-neutral-500" />
                  <span className="text-[10.5px] leading-none text-neutral-500">{audienceLabel(e.roles)}</span>
                </div>
                <div className="mt-2 flex items-center gap-[7px]">
                  <span className="rounded-full border border-neutral-800 px-2 py-[5px] text-[10px] font-medium leading-none text-neutral-400">{t.going} going</span>
                  <span className="rounded-full border px-2 py-[5px] text-[10px] font-medium leading-none" style={{ color: sd ? sd.fg : 'var(--color-neutral-500)', borderColor: sd ? 'color-mix(in srgb, ' + sd.fg + ' 40%, transparent)' : 'var(--color-neutral-800)' }}>
                    {e.rsvpClosed ? 'RSVPs closed' : sd ? 'You: ' + sd.label.toLowerCase() : 'Not answered'}
                  </span>
                </div>
              </div>
              <div className="flex flex-none flex-col items-end gap-2">
                <span className="text-[11px] font-semibold leading-none text-neutral-400">{eventLabel(e)}</span>
                <Icon name="ph ph-caret-right" className="text-[13px] text-neutral-600" />
              </div>
            </Link>
          );
        })}
      </div>

      <EventComposer open={composer} onClose={() => setComposer(false)} />
      <ReviewSheet ev={review} onClose={() => setReview(null)} />
    </Screen>
  );
}

function AudiencePicker({ roles, onChange }: { roles: AudienceId[]; onChange: (r: AudienceId[]) => void }) {
  return (
    <div className="flex flex-col gap-[5.6px]">
      {ALL_AUDIENCES.map((a) => {
        const on = roles.includes(a);
        return (
          <button
            key={a}
            onClick={() => onChange(on ? roles.filter((x) => x !== a) : ALL_AUDIENCES.filter((x) => x === a || roles.includes(x)))}
            aria-pressed={on}
            className="flex min-h-11 items-center gap-[11.2px] rounded-md border px-3 text-left"
            style={{ borderColor: on ? 'var(--color-accent-700)' : 'var(--color-neutral-800)', background: on ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'transparent' }}
          >
            <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border text-accent-100" style={{ borderColor: on ? 'var(--color-accent-500)' : 'var(--color-neutral-700)', background: on ? 'var(--color-accent-600)' : 'transparent' }}>
              {on ? <Icon name="ph ph-check" className="text-[11px]" /> : null}
            </span>
            <span className="flex-1 text-[12.5px] font-medium leading-[1.2]" style={{ color: on ? 'var(--color-neutral-100)' : 'var(--color-neutral-400)' }}>
              {AUDIENCE_LABELS[a].label}
            </span>
            <span className="text-[10.5px] leading-none text-neutral-500">{AUDIENCE_LABELS[a].hint}</span>
          </button>
        );
      })}
    </div>
  );
}

const QUICK = [
  { title: 'Squad hangout', time: '7:00p', color: '#2563EB', roles: ['members', 'captains', 'coaches', 'leaders'] as AudienceId[] },
  { title: 'Coaches’ lunch', time: '12:30p', color: '#968ae0', roles: ['coaches', 'leaders', 'admins'] as AudienceId[] },
  { title: 'Serve day', time: '9:00a', color: '#0D9488', roles: [...ALL_AUDIENCES] }
];

function EventComposer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const leader = canApprove(m.persona);
  const [team, setTeam] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [iso, setIso] = useState(isoDay(new Date(Date.now() + 7 * 86_400_000)));
  const [time, setTime] = useState('7:00p');
  const [place, setPlace] = useState('');
  const [roles, setRoles] = useState<AudienceId[]>([...ALL_AUDIENCES]);
  const [color, setColor] = useState('#968ae0');
  const name = (team ? teamOf(d, team).name + ': ' : '') + (title.trim() || 'Event name');

  const submit = () => {
    if (!title.trim()) return api().say('Give it a name first.');
    if (!roles.length) return api().say('Pick at least one group to send it to.');
    const date = new Date(iso + 'T00:00:00');
    const e: MinistryEvent = {
      id: uid(),
      title: name,
      meta: date.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + time + (place.trim() ? ' · ' + place.trim() : ''),
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      iso,
      time,
      place: place.trim(),
      color: team ? teamOf(d, team).color : color,
      roles,
      status: leader ? 'approved' : 'proposed',
      by: m.displayName + ' · ' + m.persona
    };
    api().mutate((x) => void x.events.push(e));
    api().emit({ kind: 'event', event: e });
    api().logActivity((leader ? 'Added ' : 'Proposed ') + 'the event “' + e.title + '” for ' + e.date);
    if (!leader) api().firePush('New event proposal', e.title + ' · ' + m.displayName, '/dashboard/calendar');
    api().say(leader ? 'On the calendar for ' + audienceLabel(roles).toLowerCase() + '.' : 'Sent. A leader approves it before anyone sees it.');
    setTitle('');
    setPlace('');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} label={leader ? 'Add an event' : 'Propose an event'} maxH="92%">
      <div className="text-[17px] font-medium leading-[1.2] text-neutral-100">{leader ? 'Add an event' : 'Propose an event'}</div>
      <div className="text-[11.5px] leading-[1.5] text-neutral-500 text-pretty">
        {leader ? 'It goes straight onto the calendar for the groups you pick.' : 'A squad hangout, a coaches’ lunch — it waits for a leader’s approval before anyone sees it.'}
      </div>
      <div>
        <div className={kicker + ' mb-[8.4px]'}>Quick start</div>
        <div className="flex flex-wrap gap-[7px]">
          {QUICK.map((q) => (
            <button
              key={q.title}
              onClick={() => {
                setTitle(q.title);
                setTime(q.time);
                setColor(q.color);
                setRoles(q.roles);
              }}
              className="flex min-h-11 items-center gap-[6px] rounded-full border border-neutral-800 px-3 text-[11.5px] font-medium leading-none text-neutral-300"
            >
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: q.color }} />
              {q.title}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className={kicker + ' mb-[8.4px]'}>Which squad is this for</div>
        <div className="flex flex-wrap gap-[7px]">
          {[{ id: null as string | null, name: 'All squads', color: 'var(--color-neutral-500)' }, ...d.teams].map((t) => (
            <button
              key={t.id ?? 'all'}
              onClick={() => setTeam(t.id)}
              aria-pressed={team === t.id}
              className="min-h-11 rounded-full border px-3 text-[12px] font-medium leading-none"
              style={{ borderColor: team === t.id ? t.color : 'var(--color-neutral-800)', background: team === t.id ? 'color-mix(in srgb, ' + t.color + ' 16%, transparent)' : 'transparent', color: team === t.id ? 'var(--color-neutral-100)' : 'var(--color-neutral-400)' }}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is it? e.g. Coaches’ lunch" aria-label="Event name" className="input !min-h-12" />
      <div className="text-[11px] leading-[1.4] text-neutral-500">
        Will show as: <b className="font-medium text-neutral-200">{name}</b>
      </div>
      <div className="flex gap-2">
        <label className="field flex-[3]">
          <span className="sr-label">Date</span>
          <input type="date" value={iso} onChange={(e) => setIso(e.target.value)} className="input" />
        </label>
        <label className="field flex-[2]">
          <span className="sr-label">Time</span>
          <input value={time} onChange={(e) => setTime(e.target.value)} className="input" placeholder="7:00p" />
        </label>
      </div>
      <label className="field">
        <span className="sr-label">Where</span>
        <input value={place} onChange={(e) => setPlace(e.target.value)} className="input" placeholder="Main gym, Room 204, Sunset Lanes…" />
      </label>
      <div>
        <div className={kicker + ' mb-[8.4px]'}>Who should this go to</div>
        <AudiencePicker roles={roles} onChange={setRoles} />
        {!leader ? <div className="mt-[8.4px] text-[10.5px] leading-[1.5] text-neutral-500 text-pretty">This is a request. A leader can widen or narrow it when they approve.</div> : null}
      </div>
      <div className="mt-[5.6px] flex gap-[8.4px]">
        <Btn variant="ghost" className="min-h-12 flex-1 justify-center" onClick={onClose}>
          Cancel
        </Btn>
        <Btn className="min-h-12 flex-[2] justify-center" onClick={submit}>
          {leader ? 'Add to the calendar' : 'Send for approval'}
        </Btn>
      </div>
    </Sheet>
  );
}

function ReviewSheet({ ev, onClose }: { ev: MinistryEvent | null; onClose: () => void }) {
  const api = useAppApi();
  const [roles, setRoles] = useState<AudienceId[] | null>(null);
  const current = roles ?? ev?.roles ?? [];
  const approve = () => {
    if (!ev) return;
    if (!current.length) return api().say('Pick at least one group to send it to.');
    const next: MinistryEvent = { ...ev, roles: current, status: 'approved' };
    api().mutate((x) => {
      const i = x.events.findIndex((y) => y.id === ev.id);
      if (i >= 0) x.events[i] = next;
    });
    api().emit({ kind: 'event', event: next });
    api().logActivity('Approved “' + ev.title + '” for ' + audienceLabel(current));
    api().say('Approved — ' + audienceLabel(current).toLowerCase() + ' can see it now.');
    setRoles(null);
    onClose();
  };
  return (
    <Sheet open={!!ev} onClose={() => (setRoles(null), onClose())} label="Approve event" maxH="90%">
      <div className="text-[17px] font-medium leading-[1.2] text-neutral-100">{ev?.title}</div>
      <div className="text-[11.5px] leading-[1.5] text-neutral-500">
        {ev ? eventLabel(ev) + ' · ' + ev.meta : ''} · proposed by {ev?.by}
      </div>
      <div className={kicker}>Who sees it</div>
      <AudiencePicker roles={current} onChange={setRoles} />
      <Btn className="min-h-12 justify-center" onClick={approve}>
        Approve for {audienceLabel(current).toLowerCase()}
      </Btn>
    </Sheet>
  );
}

/* ── EVENT DETAIL ──────────────────────────────────────────────────────── */
export function EventDetailScreen({ id }: { id: string }) {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const offline = useApp((s) => !s.netOnline || s.offlineSim);
  const api = useAppApi();
  const [filter, setFilter] = useState<Rsvp['status']>('going');
  const e = d.events.find((x) => x.id === id);
  if (!e) {
    return (
      <Screen label="Event detail">
        <ScreenHeader title="Event" back="/dashboard/calendar" />
        <div className="rounded-lg border border-dashed border-neutral-700 px-4 py-6 text-center text-[12px] leading-[1.5] text-neutral-500">That event isn’t on the calendar anymore.</div>
      </Screen>
    );
  }
  const p = m.persona;
  const me = practiceName(m);
  const mine = d.rsvps[e.id]?.[me];
  const t = rsvpTally(d, e, p);
  const open = canRsvp(e, p);
  const names = canSeeRsvpNames(p);
  const leader = canApprove(p);
  const today = isoDay(new Date());
  const rows = Object.entries(d.rsvps[e.id] ?? {})
    .filter(([, r]) => r.status === filter)
    .map(([name, r]) => {
      const s = d.roster.find((x) => x.name === name);
      const tm = s ? teamOf(d, s.team) : null;
      return { name, r, tint: tm?.color ?? '#3a3860', meta: (s ? (tm?.name ?? 'Unassigned') + ' · Grade ' + s.grade : 'Volunteer') + (r.guests ? ' · +' + r.guests + ' guest' + (r.guests > 1 ? 's' : '') : '') + (r.heldAt ? ' · held offline' : '') };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const answer = (status: Rsvp['status']) => {
    sendRsvp(api, e.id, me, { status, guests: status === 'going' ? mine?.guests ?? 0 : 0 });
    api().say(offline ? 'Held on this phone — it sends when you reconnect.' : status === 'going' ? 'See you there.' : status === 'maybe' ? 'Marked maybe.' : 'Thanks for letting them know.');
  };
  const guests = (delta: number) => {
    if (!mine) return;
    sendRsvp(api, e.id, me, { status: mine.status, guests: Math.max(0, Math.min(20, mine.guests + delta)) });
  };
  const saveEvent = (patch: Partial<MinistryEvent>) => {
    const next = { ...e, ...patch };
    api().mutate((x) => {
      const i = x.events.findIndex((y) => y.id === e.id);
      if (i >= 0) x.events[i] = next;
    });
    api().emit({ kind: 'event', event: next });
  };

  return (
    <Screen label="Event detail" gap={13}>
      <ScreenHeader title="Event" back="/dashboard/calendar" />
      <div className="sr-card px-4 py-[15px]" style={{ borderLeft: '3px solid ' + e.color }}>
        <div className={kicker}>{e.iso ? new Date(e.iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : e.date}</div>
        <div className="mt-2 text-[19px] font-medium leading-[1.25] text-neutral-100 text-pretty">{e.title}</div>
        <div className="mt-[6px] text-[12.5px] leading-[1.5] text-neutral-400">{e.meta}</div>
        <div className="mt-[11px] flex items-center gap-[6px] border-t border-divider pt-[11px]">
          <Icon name={audienceIcon(e.roles)} className="text-[13px] text-neutral-500" />
          <span className="text-[11px] leading-[1.3] text-neutral-500">{audienceLabel(e.roles)}</span>
        </div>
      </div>

      {e.rsvpClosed ? (
        <Note icon="ph ph-lock-simple">{leader ? 'RSVPs are closed. Nobody can change their answer — reopen it below if plans move.' : 'RSVPs are closed for this one. Message a leader if something changed.'}</Note>
      ) : null}
      {offline ? <Note icon="ph ph-cloud-slash">No signal. Your answer is kept here and sent the moment you reconnect — counts below are the last ones that reached the server.</Note> : null}

      {open ? (
        <>
          <div>
            <div className={kicker + ' mb-[9px]'}>{mine ? 'Your answer' : 'Are you coming?'}</div>
            <div className="flex gap-[7px]">
              {RSVP_STATUSES.map((o) => {
                const on = mine?.status === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => answer(o.id)}
                    aria-pressed={on}
                    className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-lg border hover:border-accent-500"
                    style={{ borderColor: on ? 'var(--color-accent-500)' : 'var(--color-neutral-800)', background: on ? 'color-mix(in srgb, var(--color-accent) 18%, transparent)' : 'transparent', color: on ? o.fg : 'var(--color-neutral-400)' }}
                  >
                    <Icon name={o.icon} className="text-[17px]" />
                    <span className="text-[11.5px] font-medium leading-none">{o.label}</span>
                  </button>
                );
              })}
            </div>
            {mine ? (
              <div className="mt-2 text-[10.5px] leading-[1.5]" style={{ color: mine.heldAt ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }}>
                {mine.heldAt ? 'Held on this phone — it sends itself when you reconnect.' : 'Answered. Tap another to change it; a leader sees the change immediately.'}
              </div>
            ) : null}
          </div>
          {mine?.status === 'going' ? (
            <div className="sr-card flex items-center gap-[11px] px-[14px] py-3">
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium leading-[1.2] text-neutral-200">Bringing anyone?</div>
                <div className="mt-[3px] text-[10.5px] leading-[1.4] text-neutral-500">{p === 'member' || p === 'captain' ? 'First-time visitors are worth points to your squad.' : 'Counted in the head count and the food order.'}</div>
              </div>
              <div className="flex flex-none items-center gap-2">
                <button aria-label="One fewer guest" onClick={() => guests(-1)} className="h-11 w-11 rounded-full border border-neutral-800 text-[15px] font-medium text-neutral-300">
                  −
                </button>
                <span className="tabular min-w-[18px] text-center text-[14px] font-semibold text-neutral-100">{mine.guests}</span>
                <button aria-label="One more guest" onClick={() => guests(1)} className="h-11 w-11 rounded-full border border-accent-600 text-[15px] font-medium text-accent-200" style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' }}>
                  +
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : !e.rsvpClosed ? (
        <Note icon="ph ph-info">This one is for {audienceLabel(e.roles).toLowerCase()} — the head count below is what they’re planning around.</Note>
      ) : null}

      <div className="flex gap-[7px]">
        {[
          { label: 'Going', value: t.going + (t.guests ? ' +' + t.guests : ''), fg: '#8fd8b0' },
          { label: 'Maybe', value: t.maybe, fg: '#e3c98d' },
          { label: 'Can’t', value: t.out, fg: '#e0a3a3' },
          { label: 'No reply', value: t.noreply, fg: 'var(--color-neutral-400)' }
        ].map((c) => (
          <div key={c.label} className="sr-card flex-1 px-2 py-[10px] text-center">
            <div className="tabular text-[17px] font-semibold leading-none" style={{ color: c.fg }}>
              {c.value}
            </div>
            <div className="mt-[5px] text-[9.5px] leading-[1.2] text-neutral-500">{c.label}</div>
          </div>
        ))}
      </div>

      {names ? (
        <div>
          <div className="mb-[9px] flex items-center gap-2">
            <div className={kicker + ' flex-1'}>Who answered</div>
            {RSVP_STATUSES.map((f) => {
              const n = f.id === 'going' ? t.going : f.id === 'maybe' ? t.maybe : t.out;
              const on = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  aria-pressed={on}
                  className="relative min-h-[30px] rounded-full border px-[10px] text-[10.5px] font-medium leading-none before:absolute before:inset-x-0 before:-inset-y-[7px] before:content-['']"
                  style={{ borderColor: on ? 'var(--color-accent-600)' : 'var(--color-neutral-800)', background: on ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)' : 'transparent', color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-500)' }}
                >
                  {f.label} {n}
                </button>
              );
            })}
          </div>
          {rows.length ? (
            <div className="sr-card overflow-hidden">
              {rows.map((r) => (
                <div key={r.name} className="flex min-h-[46px] items-center gap-[10px] border-t border-divider px-[14px] py-[9px] first:border-t-0">
                  <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-[10.5px] font-semibold leading-none text-neutral-100" style={{ background: 'color-mix(in srgb, ' + r.tint + ' 55%, var(--color-neutral-900))' }}>
                    {initialsOf(r.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium leading-[1.2] text-neutral-200">{r.name}</div>
                    <div className="mt-[3px] text-[10.5px] leading-[1.3] text-neutral-500">{r.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-neutral-700 px-4 py-[22px] text-center text-[11.5px] leading-[1.6] text-neutral-500">Nobody is down as {RSVP_STATUSES.find((x) => x.id === filter)?.label.toLowerCase()} yet.</div>
          )}
        </div>
      ) : (
        <Note icon="ph ph-eye-slash">Counts only. Names on an attendance list aren’t shown to your role.</Note>
      )}

      {leader ? (
        <div className="flex flex-col gap-2 border-t border-divider pt-[13px]">
          <div className={kicker}>Leader tools</div>
          {[
            {
              label: e.nudgedOn === today ? 'Already nudged today' : 'Nudge the ' + t.noreply + ' who haven’t answered',
              hint: e.nudgedOn === today ? 'One a day — more than that gets ignored' : 'Posts a reminder in the announcement thread',
              icon: 'ph ph-bell-ringing',
              run: () => {
                if (e.nudgedOn === today) return api().say('Already nudged today.');
                sendChat(api, 'all', 'Reminder: let us know if you’re coming to ' + e.title + ' (' + eventLabel(e) + '). Answer on the Calendar.');
                saveEvent({ nudgedOn: today });
                api().say('Nudged — the reminder is in the announcement thread.');
              }
            },
            {
              label: e.rsvpClosed ? 'Reopen RSVPs' : 'Close RSVPs',
              hint: e.rsvpClosed ? 'People can answer again' : 'Locks the head count you plan food and rides around',
              icon: e.rsvpClosed ? 'ph ph-lock-open' : 'ph ph-lock-simple',
              run: () => {
                saveEvent({ rsvpClosed: !e.rsvpClosed });
                api().logActivity((e.rsvpClosed ? 'Reopened' : 'Closed') + ' RSVPs for “' + e.title + '”');
                api().say(e.rsvpClosed ? 'RSVPs are open again.' : 'RSVPs closed — the head count is locked.');
              }
            },
            {
              label: 'Post to ' + (d.chatThreads.find((x) => x.id === 'all')?.name ?? 'the ministry'),
              hint: 'Drops the details into the whole-ministry thread',
              icon: 'ph ph-megaphone',
              run: () => {
                sendChat(api, 'all', e.title + ' — ' + eventLabel(e) + ' · ' + e.meta + '. RSVP on the Calendar.');
                api().say('Posted to the announcement thread.');
              }
            }
          ].map((a) => (
            <button key={a.label} onClick={a.run} className="flex min-h-12 w-full items-center gap-[11px] rounded-md border border-neutral-800 px-[13px] py-[10px] text-left hover:bg-[color-mix(in_srgb,var(--color-accent)_7%,transparent)]">
              <Icon name={a.icon} className="flex-none text-[16px] text-accent-400" />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium leading-[1.2] text-neutral-200">{a.label}</div>
                <div className="mt-[3px] text-[10.5px] leading-[1.4] text-neutral-500">{a.hint}</div>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </Screen>
  );
}

function Note({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-[9px] rounded-md border border-neutral-700 px-3 py-[10px]" style={{ background: 'color-mix(in srgb, var(--color-neutral-800) 55%, transparent)' }}>
      <Icon name={icon} className="mt-[1px] flex-none text-[14px] text-neutral-500" />
      <div className="text-[11px] leading-[1.5] text-neutral-400 text-pretty">{children}</div>
    </div>
  );
}
