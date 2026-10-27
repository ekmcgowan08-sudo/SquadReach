'use client';
/* PLANNER · PREP & RECAP — the week around the night, from a desk. Prep
   week: the countdown with the week laid out as a line, the reminders as a
   table, and what has to be ready. Recap: the night in five numbers, then
   attendance, follow-ups and notes side by side. It turns to Recap by itself
   once the night wraps; the title switches between them. */
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useCycle, usePreviewPick } from '@/components/cycle/use-cycle';
import { TitleSwitch } from '@/components/planner/kit';
import { AttendanceTab, FollowupsTab, NotesTab } from '@/components/screens/night-recap';
import { readyBy, useReminders } from '@/components/screens/prep-week';
import { Btn, Icon, cx } from '@/components/ui';
import { attendanceStats, checkinOpen, clock, countdown, dayLabel, followups, isAfter, weekday, type NightTimes, type ReminderView } from '@/lib/cycle';
import { weekOf } from '@/lib/dates';
import { teachingByNight, yearOf } from '@/lib/plan';

export function PrepRecap() {
  const c = useCycle();
  const { d, iso, t, now } = c;
  const params = useSearchParams();
  const router = useRouter();
  const asked = params.get('view');
  const view = asked === 'prep' || asked === 'recap' ? asked : isAfter(t, now) ? 'recap' : 'prep';
  const teach = teachingByNight(d.plan, yearOf(d.plan, iso))[iso];
  const week = weekOf(d.config.meetingDates, iso);
  const kicker = (teach ? teach.series.title + ' · week ' + teach.week : 'Week ' + week + (d.config.gameName ? ' · ' + d.config.gameName : '')) + ' · ' + dayLabel(t.setup);

  return (
    <div className="flex flex-col gap-5">
      <TitleSwitch
        kicker={kicker}
        value={view}
        options={[
          { id: 'prep', label: 'Prep week' },
          { id: 'recap', label: 'Recap' }
        ]}
        onChange={(v) => router.replace('/planner/prep?view=' + v)}
        right={c.m.mode === 'demo' ? <PreviewBar t={t} stages={c.stages} current={c.preview?.id ?? null} onPick={() => asked && router.replace('/planner/prep')} /> : null}
      />
      {view === 'prep' ? <Prep /> : <Recap />}
    </div>
  );
}

/** Demo only: the week at another moment, as one segmented bar. */
function PreviewBar({ t, stages, current, onPick }: { t: NightTimes; stages: { id: string; short: string; at: number }[]; current: string | null; onPick: () => void }) {
  const pick = usePreviewPick();
  const cur = stages.find((s) => s.id === current);
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="text-[12.5px] text-neutral-400">
        Preview as of <span className="text-neutral-100">{cur ? dayLabel(cur.at) + ' · ' + clock(cur.at) : 'now'}</span>
        {cur ? (
          <button onClick={() => (pick(null, t), onPick())} className="ml-3 font-medium text-accent-300">
            Back to now
          </button>
        ) : null}
      </div>
      <div role="group" aria-label="Preview as of" className="flex flex-wrap rounded-md border border-neutral-800 bg-neutral-900 p-[3px]">
        {stages.map((g) => {
          const on = g.id === current;
          return (
            <button
              key={g.id}
              onClick={() => (pick(on ? null : g.id, t), onPick())}
              aria-pressed={on}
              className={cx('min-h-9 whitespace-nowrap rounded-[6px] px-[10px] text-[12.5px]', on ? 'bg-neutral-800 font-medium text-neutral-100' : 'text-neutral-400 hover:text-neutral-200')}
            >
              {g.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── prep week ─────────────────────────────────────────────────────────── */
function Prep() {
  const { d, iso, t, now } = useCycle();
  const { rems, post, toggle, words } = useReminders();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const cd = countdown(t, now);
  const ready = readyBy(d, iso, now);
  const toClose = ready.filter((r) => r.action).length;
  const next = rems.find((r) => !r.sent && !r.off);
  const sent = rems.filter((r) => r.sent).length;
  const aud = (r: ReminderView) => r.aud.map((a) => (a === 'leaders' ? 'leaders' : 'parents')).join(' and ');

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        <section className="sr-card flex flex-col gap-6 px-8 py-7">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-[.12em] text-accent-300">{cd.phase === 'prep' ? 'Gathering night · ' + dayLabel(t.setup) + ' · ' + clock(t.setup) + ' setup' : cd.kicker}</div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <span className="tabular text-[56px] font-medium leading-none tracking-[-.02em] text-neutral-100">{cd.big}</span>
              <span className="text-[16px] text-neutral-400">{cd.line}</span>
            </div>
          </div>
          <WeekLine t={t} rems={rems} now={now} />
        </section>

        <section className="sr-card flex flex-col px-7 py-6">
          <div className="flex items-baseline gap-3 pb-2">
            <h2 className="flex-1 text-[19px] font-medium text-neutral-100">Reminders</h2>
            <span className="text-[12.5px] text-neutral-500">
              {sent} of {rems.length} posted
            </span>
          </div>
          {rems.map((r, i) => (
            <div key={r.id} className={cx('grid grid-cols-[150px_minmax(0,1fr)] gap-5 py-4', i > 0 && 'border-t border-divider')} style={{ opacity: r.off ? 0.55 : 1 }}>
              <div>
                <div className="text-[14.5px] font-medium leading-[1.3] text-neutral-100">{r.label}</div>
                <div className="mt-1 text-[12.5px] text-neutral-500">
                  {dayLabel(r.at)} · {clock(r.at)}
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {r.aud.map((a) => (
                    <span key={a} className="rounded-[5px] bg-neutral-800 px-2 py-[3px] text-[11.5px] font-medium text-neutral-300">
                      {a === 'leaders' ? 'Leaders' : 'Parents'}
                    </span>
                  ))}
                  <span className="text-[12.5px]" style={{ color: r.sent ? 'var(--color-neutral-200)' : 'var(--color-neutral-500)' }}>
                    {r.status}
                    {r.early ? ' · sent early' : ''}
                  </span>
                </div>
                {!r.sent && editing !== r.id ? (
                  <div className="-my-1 flex flex-wrap justify-end gap-2">
                    <Btn
                      variant="ghost"
                      className="px-3 text-[12.5px] text-accent-300"
                      onClick={() => {
                        setDraft(r.text);
                        setEditing(r.id);
                      }}
                    >
                      Edit words
                    </Btn>
                    {!r.off ? (
                      <Btn variant="secondary" className="px-4 text-[12.5px]" onClick={() => post(r)}>
                        Post now
                      </Btn>
                    ) : null}
                    <Btn variant="ghost" className="px-3 text-[12.5px] text-neutral-400" onClick={() => toggle(r)}>
                      {r.off ? 'Turn on' : 'Turn off'}
                    </Btn>
                  </div>
                ) : null}
                {editing === r.id ? (
                  <div className="flex flex-col gap-2">
                    <textarea className="input min-h-[84px] py-2 text-[13.5px] leading-[1.5]" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={'Words for ' + r.label} />
                    <div className="flex gap-2">
                      <Btn
                        className="px-4 text-[12.5px]"
                        disabled={!draft.trim()}
                        onClick={() => {
                          words(r, draft.trim());
                          setEditing(null);
                        }}
                      >
                        Save for this week
                      </Btn>
                      <Btn variant="ghost" className="px-4 text-[12.5px] text-neutral-400" onClick={() => setEditing(null)}>
                        Cancel
                      </Btn>
                    </div>
                  </div>
                ) : (
                  <div className="text-[14px] leading-[1.6] text-neutral-200 text-pretty">{r.text}</div>
                )}
              </div>
            </div>
          ))}
          <div className="border-t border-divider pt-3 text-[12px] leading-[1.5] text-neutral-500">
            A posted reminder lands in the leaders’ notifications and on each family’s link. Times and wording live in{' '}
            <Link href="/console?tab=season" className="text-accent-300 underline underline-offset-2">
              Console · Setup
            </Link>
            .
          </div>
        </section>
      </div>

      <section className="sr-card flex flex-col px-6 py-5">
        <div className="flex items-baseline gap-3 pb-2">
          <h2 className="flex-1 text-[19px] font-medium text-neutral-100">Ready by {weekday(iso)}</h2>
          <span className="text-[12.5px] text-neutral-500">{toClose ? toClose + ' to close' : 'all set'}</span>
        </div>
        {ready.map((x) => (
          <Link key={x.title} href={x.deskHref} className="flex items-start gap-3 border-b border-divider py-3 text-left sr-hover" style={{ color: 'inherit' }}>
            <Icon name={'ph ' + x.icon} className="mt-[2px] flex-none text-[17px] text-accent-300" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium leading-[1.35] text-neutral-100">{x.title}</div>
              <div className="mt-[3px] text-[12.5px] leading-[1.45] text-neutral-500 text-pretty">{x.meta}</div>
            </div>
            {x.action ? <span className="flex-none pt-[1px] text-[12.5px] font-medium text-neutral-100">{x.action}</span> : null}
          </Link>
        ))}
        <div className="flex items-start gap-3 py-3">
          <Icon name={next ? 'ph ph-bell' : 'ph ph-bell-simple-ringing'} className="mt-[2px] flex-none text-[17px] text-accent-300" />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-medium leading-[1.35] text-neutral-100">{next ? 'Next reminder: ' + next.label : sent ? 'Every reminder posted' : 'No reminders on'}</div>
            <div className="mt-[3px] text-[12.5px] leading-[1.45] text-neutral-500">
              {next ? dayLabel(next.at) + ' · ' + clock(next.at) + ' to ' + aud(next) : sent ? sent + ' posted this week.' : 'Switch one on above.'}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/** The week as a line: a tick a day, a dot per reminder (filled once it has
 *  gone), the night itself, and when follow-ups are due. */
function WeekLine({ t, rems, now }: { t: NightTimes; rems: ReminderView[]; now: number }) {
  const noon = (ms: number) => {
    const x = new Date(ms);
    return new Date(x.getFullYear(), x.getMonth(), x.getDate(), 12).getTime();
  };
  const DAY = 86_400_000;
  const first = noon(Math.min(t.setup, ...rems.map((r) => r.at))) - 2 * DAY;
  const last = noon(t.due);
  const days = Math.round((last - first) / DAY) + 1;
  const x = (ms: number) => Math.max(0, Math.min(1, (ms - first) / (last - first))) * 100;
  const marks = [
    ...rems.map((r) => ({ id: r.id, at: r.at, label: r.label, kind: r.off ? ('off' as const) : r.sent ? ('sent' as const) : ('due' as const) })),
    { id: 'due', at: t.due, label: 'Follow-ups due', kind: now > t.due ? ('sent' as const) : ('end' as const) }
  ].sort((a, b) => a.at - b.at);
  /* Labels that would collide step up a row. */
  const placed = marks.reduce<((typeof marks)[number] & { x: number; row: number })[]>((out, m) => {
    const at = x(m.at);
    const before = out[out.length - 1];
    out.push({ ...m, x: at, row: before && at - before.x < 9 && before.row === 0 ? 1 : 0 });
    return out;
  }, []);
  const nowX = now >= first && now <= last ? x(now) : null;
  return (
    <div className="relative mx-2 h-[86px]" aria-label={'The week: ' + marks.map((m) => m.label + ' ' + dayLabel(m.at)).join(', ')} role="img">
      {placed.map((m) => (
        <span key={'l' + m.id} className={cx('absolute whitespace-nowrap text-[11.5px] leading-none', m.x > 90 ? '-translate-x-full' : m.x < 6 ? '' : '-translate-x-1/2')} style={{ left: m.x + '%', top: m.row ? 0 : 17, color: m.kind === 'sent' ? 'var(--color-neutral-100)' : 'var(--color-neutral-400)' }}>
          {m.label}
        </span>
      ))}
      <div className="absolute inset-x-0 top-[42px] h-px bg-neutral-700" />
      <span className="absolute top-[34px] h-[17px] rounded-[4px] bg-accent-500" style={{ left: x(t.setup) + '%', width: 'max(7px, ' + (x(t.end) - x(t.setup)) + '%)' }} title={'The night · ' + clock(t.setup) + '–' + clock(t.end)} />
      {placed.map((m) => (
        <span
          key={'d' + m.id}
          className="absolute top-[36px] h-[13px] w-[13px] -translate-x-1/2 rounded-full border-2"
          style={{
            left: m.x + '%',
            borderColor: m.kind === 'off' ? 'var(--color-neutral-700)' : m.kind === 'end' ? 'var(--color-neutral-500)' : 'var(--color-accent-400)',
            background: m.kind === 'sent' ? 'var(--color-accent-400)' : 'var(--color-surface)'
          }}
        />
      ))}
      {nowX != null ? <span className="absolute top-[26px] h-[32px] w-[2px] -translate-x-1/2 rounded-full bg-neutral-100" style={{ left: nowX + '%' }} title="Now" /> : null}
      {Array.from({ length: days }, (_, i) => {
        const at = first + i * DAY;
        const day = new Date(at);
        return (
          <span key={i} className="absolute top-[62px] -translate-x-1/2 whitespace-nowrap text-[11.5px] leading-none text-neutral-500" style={{ left: x(at) + '%' }}>
            {day.toLocaleDateString('en-US', { weekday: 'short' })} {day.getDate()}
          </span>
        );
      })}
    </div>
  );
}

/* ── recap ─────────────────────────────────────────────────────────────── */
function Recap() {
  const { d, iso, t, now, me } = useCycle();
  const stats = attendanceStats(d);
  const open = checkinOpen(t, now) || isAfter(t, now);
  const after = isAfter(t, now);
  const fus = followups(d, iso, now, me);
  const regulars = stats.here - stats.visitors;
  const prayers = [...d.prayerQueue, ...d.prayers].filter((p) => p.at >= t.setup && p.at <= t.end).length;
  const cards = [
    { label: 'In the room', value: open ? String(stats.here) : '–', hint: open ? regulars + ' of ' + stats.total + ' regulars' + (stats.visitors ? ' + ' + stats.visitors + ' new' : '') : 'Check-in opens ' + clock(t.checkinOpen) },
    { label: 'Checked in by', value: open ? stats.qr + ' QR' : '–', hint: open ? stats.leader + ' tapped in by a leader' : 'QR at the door or a leader tap' },
    { label: 'First-timers', value: String(stats.visitors), hint: stats.visitors ? 'Each gets a welcome follow-up' : 'Add them at the door' },
    { label: 'Prayer requests', value: String(prayers), hint: 'Only leaders read them; coaches see that one exists' },
    { label: 'Follow-ups', value: after ? fus.filter((f) => f.done).length + ' / ' + fus.length : '–', hint: after ? fus.filter((f) => f.mine && !f.done).length + ' still yours' : 'Built at ' + clock(t.end) }
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((s) => (
          <div key={s.label} className="sr-card flex flex-col gap-2 px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-neutral-400">{s.label}</div>
            <div className="tabular text-[28px] font-medium leading-none text-neutral-100">{s.value}</div>
            <div className="text-[12.5px] leading-[1.4] text-neutral-400 text-pretty">{s.hint}</div>
          </div>
        ))}
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,0.85fr)]">
        <section className="sr-card flex flex-col gap-3 px-[18px] py-5">
          <h2 className="text-[19px] font-medium text-neutral-100">Attendance</h2>
          <AttendanceTab stats={false} />
        </section>
        <section className="sr-card flex flex-col gap-3 px-6 py-5">
          <h2 className="text-[19px] font-medium text-neutral-100">Follow-ups</h2>
          <FollowupsTab grouped />
        </section>
        <section className="sr-card flex flex-col gap-3 px-6 py-5">
          <h2 className="text-[19px] font-medium text-neutral-100">Notes</h2>
          <NotesTab />
          <Link href={'/planner/season?night=' + iso + '&debrief=1'} className="inline-flex min-h-11 items-center gap-[6px] text-[13px] font-medium text-neutral-100">
            Open the full debrief
            <Icon name="ph ph-arrow-right" className="text-[13px]" />
          </Link>
        </section>
      </div>
    </div>
  );
}
