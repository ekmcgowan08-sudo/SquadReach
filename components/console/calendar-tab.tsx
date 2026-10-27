'use client';
/* CONSOLE · CALENDAR — everything scheduled and everything waiting on a
   leader, in one table, and the event types staff start from when they
   add or propose an event on the phone. */
import Link from 'next/link';
import { Blur, Section, useSaveConfig } from '@/components/console/kit';
import { AUDIENCE_LABELS, audienceLine } from '@/components/screens/calendar';
import { Btn, Icon, cx } from '@/components/ui';
import { isoDay } from '@/lib/dates';
import { ALL_AUDIENCES, eventLabel } from '@/lib/selectors';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import { DEFAULT_EVENT_TYPES, type EventType, type MinistryEvent } from '@/lib/types/model';

const COLORS = ['#2563EB', '#968ae0', '#0D9488', '#e0a23f', '#d9708c', '#E4572E', '#74b37a'];

export function CalendarTab() {
  const d = useApp((s) => s.data);
  const api = useAppApi();
  const save = useSaveConfig();
  const types = d.config.eventTypes ?? DEFAULT_EVENT_TYPES;
  const today = isoDay(new Date());
  const rows = [...d.events].sort((a, b) => (a.status === 'proposed' ? 0 : 1) - (b.status === 'proposed' ? 0 : 1) || (a.iso ?? '9').localeCompare(b.iso ?? '9'));
  const waiting = rows.filter((e) => e.status === 'proposed').length;

  const setType = (t: EventType, note?: string) => save((c) => ({ eventTypes: (c.eventTypes ?? DEFAULT_EVENT_TYPES).some((x) => x.id === t.id) ? (c.eventTypes ?? DEFAULT_EVENT_TYPES).map((x) => (x.id === t.id ? t : x)) : [...(c.eventTypes ?? DEFAULT_EVENT_TYPES), t] }), note);
  const approve = (e: MinistryEvent) => {
    const next: MinistryEvent = { ...e, status: 'approved' };
    api().mutate((x) => {
      const i = x.events.findIndex((y) => y.id === e.id);
      if (i >= 0) x.events[i] = next;
    });
    api().emit({ kind: 'event', event: next });
    api().logActivity('Approved “' + e.title + '”');
  };
  const decline = (e: MinistryEvent) => {
    if (!window.confirm('Decline “' + e.title + '”?')) return;
    api().mutate((x) => void (x.events = x.events.filter((y) => y.id !== e.id)));
    api().emit({ kind: 'eventRemove', id: e.id });
    api().logActivity('Declined the proposed event “' + e.title + '”');
  };

  return (
    <div className="flex flex-col gap-5">
      <Section
        title="Scheduled & proposed"
        sub="Coaches, captains and scorekeepers propose events on the phone; nobody sees one until a leader approves it. Approve here as proposed, or open it on the phone to change who sees it first."
        right={waiting ? <span className="whitespace-nowrap rounded-full border border-accent-600 px-3 py-[6px] text-[12px] text-accent-100">{waiting} waiting</span> : undefined}
      >
        {rows.length ? (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-[.1em] text-neutral-500">
                <th className="py-2 pr-3 font-semibold">Title</th>
                <th className="py-2 pr-3 font-semibold">Date</th>
                <th className="py-2 pr-3 font-semibold">Who sees it</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const past = !!e.iso && e.iso < today;
                return (
                  <tr key={e.id} className="border-t border-divider">
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 flex-none rounded-full" style={{ background: e.color }} />
                        <Link href={'/dashboard/events/' + e.id} className={cx('hover:underline', past ? 'text-neutral-400' : 'text-neutral-100')}>
                          {e.title}
                        </Link>
                      </span>
                    </td>
                    <td className={cx('whitespace-nowrap py-2 pr-3', past ? 'text-neutral-400' : 'text-neutral-300')}>{eventLabel(e)}</td>
                    <td className="py-2 pr-3 text-neutral-400">{audienceLine(e.roles)}</td>
                    <td className="whitespace-nowrap py-2 pr-3">{e.status === 'proposed' ? <span className="text-accent-200">Waiting · {e.by?.split(' · ')[0] ?? 'staff'}</span> : <span className={past ? 'text-neutral-400' : 'text-neutral-300'}>{past ? 'Done' : 'Live'}</span>}</td>
                    <td className="py-2">
                      {e.status === 'proposed' ? (
                        <span className="flex justify-end gap-2">
                          <Btn variant="secondary" className="px-3" onClick={() => approve(e)} ariaLabel={'Approve ' + e.title}>
                            Approve
                          </Btn>
                          <Btn variant="ghost" className="px-3" onClick={() => decline(e)} ariaLabel={'Decline ' + e.title}>
                            Decline
                          </Btn>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-[13px] text-neutral-500">Nothing on the calendar yet.</p>
        )}
      </Section>

      <Section
        title="Event types"
        sub="The quick starts staff see when they add or propose an event: each fills in the name, time, place, colour and who it goes to. They can still change anything before sending."
        right={
          <Btn className="px-4" onClick={() => setType({ id: uid(), title: 'New event', time: '7:00p', place: '', color: COLORS[types.length % COLORS.length], roles: [...ALL_AUDIENCES] }, 'Added an event type')}>
            <Icon name="ph ph-plus" className="mr-[6px] text-[14px]" />
            Add event type
          </Btn>
        }
      >
        {!types.length ? <p className="text-[13px] text-neutral-500">No event types. Staff start every event from a blank form.</p> : null}
        {types.map((t) => (
          <div key={t.id} role="group" aria-label={'Event type: ' + t.title} className="flex flex-col gap-2 rounded-md border border-neutral-800 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <button aria-label={'Change the colour of ' + t.title} title="Change colour" onClick={() => setType({ ...t, color: COLORS[(COLORS.indexOf(t.color) + 1) % COLORS.length] })} className="flex h-11 w-8 flex-none items-center justify-center">
                <span className="h-5 w-5 rounded" style={{ background: t.color }} />
              </button>
              <Blur label="Name" value={t.title} onSave={(v) => v && setType({ ...t, title: v }, 'Renamed an event type to ' + v)} className="min-w-[160px] flex-1" />
              <Blur label="Time" value={t.time} onSave={(v) => setType({ ...t, time: v })} className="w-[110px]" />
              <Blur label="Where" value={t.place ?? ''} placeholder="Main gym" onSave={(v) => setType({ ...t, place: v })} className="min-w-[160px] flex-1" />
              <button
                aria-label={'Remove ' + t.title}
                onClick={() => window.confirm('Remove the event type “' + t.title + '”? Events already on the calendar stay.') && save((c) => ({ eventTypes: (c.eventTypes ?? DEFAULT_EVENT_TYPES).filter((x) => x.id !== t.id) }), 'Removed the event type ' + t.title)}
                className="flex h-11 w-11 flex-none items-center justify-center rounded-md border border-neutral-800 text-neutral-500 hover:text-neutral-200"
              >
                <Icon name="ph ph-trash" className="text-[15px]" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-[6px]" role="group" aria-label={'Who ' + t.title + ' goes to'}>
              <span className="mr-1 text-[12px] text-neutral-400">Goes to:</span>
              {ALL_AUDIENCES.map((a) => {
                const on = t.roles.includes(a);
                return (
                  <button key={a} aria-pressed={on} onClick={() => setType({ ...t, roles: on ? t.roles.filter((x) => x !== a) : ALL_AUDIENCES.filter((x) => x === a || t.roles.includes(x)) })} className={cx('min-h-8 rounded-md border px-3 text-[12px]', on ? 'border-accent-600 text-accent-100' : 'border-neutral-800 text-neutral-500')}>
                    {AUDIENCE_LABELS[a].label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}
