'use client';
/* PREP WEEK — the days before the night. A countdown to setup, the four
   reminders that go out on their own (post one early, switch one off, change
   its words for this week), and what has to be true by the night, each row
   linking to the screen that fixes it. */
import { useState } from 'react';
import { PreviewClock } from '@/components/cycle/bits';
import { useCycle, useNightSave } from '@/components/cycle/use-cycle';
import { Btn, Icon, Label, Screen, ScreenHeader } from '@/components/ui';
import { countdown, dayLabel, reminders, slipDueLabel, slipsView, weekday, type ReminderView } from '@/lib/cycle';
import { isoDay, nowMs, weekOf } from '@/lib/dates';
import { uncoveredPosts } from '@/lib/feeds';
import { useAppApi } from '@/lib/store/provider';
import type { MinistryData } from '@/lib/types/model';
import Link from 'next/link';

/** The night's reminders, and what a leader can do to each: post it early,
 *  switch it off, or change its words for this week only. */
export function useReminders() {
  const { d, m, iso, night, now, preview } = useCycle();
  const api = useAppApi();
  const saveNight = useNightSave();
  const setRem = (id: string, patch: { off?: boolean; sentAt?: number; text?: string }) => {
    saveNight(iso, (n) => void (n.rem[id] = { ...n.rem[id], ...patch }));
    api().emit({ kind: 'reminder', date: iso, id, rec: { ...night.rem[id], ...patch } });
  };
  return {
    rems: reminders(d, iso, now),
    post: (r: ReminderView) => {
      setRem(r.id, { sentAt: preview ? now : nowMs(), off: false });
      api().logActivity(r.label + ' reminder posted early by ' + m.displayName);
      api().say(r.label + ' reminder posted.');
    },
    toggle: (r: ReminderView) => setRem(r.id, { off: !r.off }),
    words: (r: ReminderView, text: string) => {
      setRem(r.id, { text });
      api().say('Saved for ' + weekday(iso) + '’s reminder.');
    }
  };
}

export interface ReadyItem {
  icon: string;
  title: string;
  meta: string;
  href: string;
  /** The same fix from the desk planner. */
  deskHref: string;
  /** What the row asks for, while it is still open. */
  action: string | null;
}

/** What has to be true by the night, each row pointing at its fix. */
export function readyBy(d: MinistryData, iso: string, now: number): ReadyItem[] {
  const open = uncoveredPosts(d.huddle);
  const pend = d.serving.swaps.filter((s) => s.status === 'pending');
  const done = d.huddle.ready.filter((r) => r.done).length;
  const slipsTonight = slipsView(d).filter((v) => v.slip.due.split('T')[0] <= iso && v.slip.due.split('T')[0] >= isoDay(new Date(now)));
  return [
    {
      icon: open.length ? 'ph-user-plus' : 'ph-check-circle',
      title: open.length ? open.length + (open.length === 1 ? ' post still open' : ' posts still open') : 'Every post is covered',
      meta: open.map((o) => o.post).join(', ') || 'Tonight is fully staffed.',
      href: '/dashboard/huddle',
      deskHref: '/planner/people',
      action: open.length ? 'Fill' : null
    },
    ...slipsTonight.map((v) => ({
      icon: v.signedN < v.total ? 'ph-signature' : 'ph-check-circle',
      title: v.slip.title + ': ' + v.signedN + ' of ' + v.total + ' signed',
      meta: v.kids.filter((k) => !k.signed).map((k) => k.name).join(', ') || 'Everyone is cleared. ' + slipDueLabel(v.slip, isoDay(new Date(now))) + '.',
      href: '/dashboard/parents',
      deskHref: '/planner/people?tab=parents',
      action: v.signedN < v.total ? 'Nudge' : null
    })),
    {
      icon: pend.length ? 'ph-swap' : 'ph-check-circle',
      title: pend.length ? pend.length + (pend.length === 1 ? ' swap request waiting' : ' swap requests waiting') : 'No swap requests',
      meta: pend.map((x) => x.from + ', ' + x.role).join(' · ') || 'Volunteers ask from Serving.',
      href: '/dashboard/serving',
      deskHref: '/planner/people',
      action: pend.length ? 'Review' : null
    },
    {
      icon: done < d.huddle.ready.length ? 'ph-list-checks' : 'ph-check-circle',
      title: 'Ready check ' + done + ' of ' + d.huddle.ready.length,
      meta: d.huddle.ready.filter((r) => !r.done).map((r) => r.label).join(' · ') || 'Everything is set.',
      href: '/dashboard/huddle',
      deskHref: '/planner',
      action: done < d.huddle.ready.length ? 'Open' : null
    }
  ];
}

export function PrepWeekScreen({ bare }: { bare?: boolean } = {}) {
  const { d, m, iso, t, now, stages, preview } = useCycle();
  const { rems, post, toggle, words } = useReminders();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const cd = countdown(t, now);
  const week = weekOf(d.config.meetingDates, iso);
  const ready = readyBy(d, iso, now);

  return (
    <Screen label="Prep week">
      {!bare ? <ScreenHeader title="Prep week" sub={dayLabel(t.setup) + ' · week ' + week + (d.config.gameName ? ' · ' + d.config.gameName : '')} back="/dashboard/more" /> : null}
      <PreviewClock t={t} stages={stages} current={preview?.id ?? null} mode={m.mode} />

      <div className="sr-card px-[15px] py-4">
        <Label accent>{cd.kicker}</Label>
        <div className="tabular mt-[10px] text-[30px] font-medium leading-[1.05] tracking-[-.02em] text-neutral-100">{cd.big}</div>
        <div className="mt-[5px] text-[12px] leading-[1.4] text-neutral-400">{cd.line}</div>
      </div>

      <div className="flex items-baseline justify-between">
        <Label>Reminders</Label>
        <div className="text-[10.5px] text-neutral-500">{rems.filter((r) => r.sent).length + ' of ' + rems.length + ' posted'}</div>
      </div>
      {rems.map((r) => (
        <div key={r.id} className="sr-card flex flex-col gap-[7px] px-[14px] py-[13px]" style={{ opacity: r.off ? 0.55 : 1 }}>
          <div className="flex items-baseline gap-2">
            <span className="flex-1 text-[13.5px] font-medium leading-[1.2] text-neutral-100">
              {r.label} · {dayLabel(r.at).replace(/^\w+, /, '')}
            </span>
            <span className="text-[10.5px] text-neutral-500">{r.aud.map((a) => (a === 'leaders' ? 'Leaders' : 'Parents')).join(' + ')}</span>
          </div>
          <div className="text-[10.5px] leading-[1.3]" style={{ color: r.sent ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }}>
            {r.status}
            {r.early ? ' · sent early' : ''}
          </div>
          {editing === r.id ? (
            <>
              <textarea className="input min-h-[84px] py-2 text-[12.5px] leading-[1.5]" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={'Words for ' + r.label} />
              <div className="flex gap-[7px]">
                <Btn
                  variant="secondary"
                  className="flex-1 justify-center text-[12px]"
                  disabled={!draft.trim()}
                  onClick={() => {
                    words(r, draft.trim());
                    setEditing(null);
                  }}
                >
                  Save for this week
                </Btn>
                <Btn variant="ghost" className="flex-1 justify-center text-[12px] text-neutral-400" onClick={() => setEditing(null)}>
                  Cancel
                </Btn>
              </div>
            </>
          ) : (
            <div className="text-[12px] leading-[1.5] text-neutral-300 text-pretty">{r.text}</div>
          )}
          {!r.sent && editing !== r.id ? (
            <div className="mt-[2px] flex gap-[7px]">
              {!r.off ? (
                <Btn
                  variant="secondary"
                  className="flex-1 justify-center text-[12px]"
                  onClick={() => post(r)}
                >
                  Post now
                </Btn>
              ) : null}
              <Btn
                variant="ghost"
                className="flex-1 justify-center text-[12px] text-neutral-400"
                onClick={() => {
                  setDraft(r.text);
                  setEditing(r.id);
                }}
              >
                Edit words
              </Btn>
              <Btn variant="ghost" className="flex-1 justify-center text-[12px] text-neutral-400" onClick={() => toggle(r)}>
                {r.off ? 'Turn on' : 'Turn off'}
              </Btn>
            </div>
          ) : null}
        </div>
      ))}
      <div className="text-[11px] leading-[1.5] text-neutral-500 text-pretty">
        A posted reminder lands in the leaders’ notifications and on each family’s link. Times and wording live in Console · Setup.
      </div>

      <Label className="mt-1">Ready by {weekday(iso)}</Label>
      <div className="sr-card overflow-hidden">
        {ready.map((x, i) => (
          <Link key={x.title} href={x.href} className="flex items-start gap-[11px] px-[15px] py-3 text-left sr-hover" style={{ borderTop: i ? '1px solid var(--color-divider)' : undefined, color: 'inherit' }}>
            <Icon name={'ph ' + x.icon} className="mt-[1px] flex-none text-[16px] text-accent-300" />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium leading-[1.3] text-neutral-100">{x.title}</div>
              <div className="mt-[2px] text-[11px] leading-[1.45] text-neutral-500 text-pretty">{x.meta}</div>
            </div>
            <Icon name="ph ph-caret-right" className="mt-[2px] flex-none text-[13px] text-neutral-600" />
          </Link>
        ))}
      </div>
    </Screen>
  );
}
