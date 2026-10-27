'use client';
/* The planner's leader tour: one card that follows a new leader across
   every desk screen, in the order a week is run. Its place is kept in this
   browser's preferences, so it survives navigation and reloads; Escape or
   the close button ends it. */
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Icon } from '@/components/ui';
import { setPrefs, usePrefs } from '@/lib/prefs';

export const DESK_STEPS: { href: string; title: string; body: string }[] = [
  { href: '/planner', title: 'Home is tonight', body: 'The running order, the countdown and who is on. Everything here updates live from your other leaders’ phones.' },
  { href: '/planner', title: 'Fill roles, tick the ready check', body: 'An open role says so in Who’s on. A tick on the ready check shows on every phone within a second.' },
  { href: '/planner/prep?view=prep', title: 'Prep week', body: 'Reminders go out three days before, the day before, the morning of and an hour out. Change the words, post one early or switch it off.' },
  { href: '/planner/prep?view=recap', title: 'Recap after the night', body: 'Attendance comes from QR scans at the door and leader taps. Follow-ups build themselves when the night wraps and are due within 48 hours.' },
  { href: '/planner/people', title: 'Volunteers', body: 'Who serves the next four nights. Volunteers ask for swaps on the phone, and nothing changes until you approve.' },
  { href: '/planner/people?tab=parents', title: 'Parents', body: 'Message families, track permission slips and move pickup. Parents see their own child only, on their private link.' },
  { href: '/planner/season', title: 'Season and night', body: 'Build each night block by block, and debrief it afterwards. Home reads tonight from here.' },
  { href: '/planner/live', title: 'Ministry time', body: 'Trivia, word clouds and verse fill-ins that students answer on their phones during the night.' },
  { href: '/planner/year', title: 'Ministry year', body: 'Seasons from August to July, and what each one teaches.' },
  { href: '/planner/roadmap', title: 'Seven-year roadmap', body: 'The whole arc across a student’s years with you. Journey follows one class down it.' },
  { href: '/planner/coverage', title: 'Coverage', body: 'What each graduating class will have received, and where the gaps are — each with its reason.' },
  { href: '/planner/liturgical', title: 'Liturgical year', body: 'Advent, Lent and the rest, lined up against your nights.' },
  { href: '/planner/settings', title: 'Settings', body: 'Lanes, blocks, seasons and roles. That’s the tour — press ⌘K anywhere to jump between screens.' }
];

export function startDeskTour() {
  setPrefs({ deskTour: { on: true, i: 0 } });
}

const pathOf = (href: string) => href.split('?')[0];

export function DeskTourCard() {
  const { deskTour } = usePrefs();
  const router = useRouter();
  const path = usePathname();
  const { on, i } = deskTour;
  const step = DESK_STEPS[i];

  useEffect(() => {
    if (!on) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setPrefs({ deskTour: { on: false, i: 0 } });
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [on]);

  /* The card waits on its own screen if the leader wandered off. */
  if (!on || !step || path !== pathOf(step.href)) return null;
  const last = i === DESK_STEPS.length - 1;
  const go = (n: number) => {
    setPrefs({ deskTour: { on: true, i: n } });
    router.push(DESK_STEPS[n].href);
  };
  return (
    <div role="dialog" aria-label="Leader tour" className="fixed bottom-7 right-7 z-[60] w-[380px] rounded-lg border border-accent-700 bg-neutral-900 px-[22px] pb-4 pt-5 animate-[sr-rise_.25s_ease_both]" style={{ boxShadow: 'var(--shadow-lg)' }}>
      <div className="mb-3 flex items-center gap-[10px]">
        <span className="text-[11.5px] font-medium uppercase leading-none tracking-[.12em] text-accent-300">Leader tour</span>
        <span className="text-[12.5px] leading-none text-neutral-500">
          {i + 1} of {DESK_STEPS.length}
        </span>
        <span className="flex-1" />
        <button aria-label="End the tour" onClick={() => setPrefs({ deskTour: { on: false, i: 0 } })} className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:text-neutral-300">
          <Icon name="ph ph-x" className="text-[15px]" />
        </button>
      </div>
      <div className="mb-[14px] flex gap-[3px]" aria-hidden>
        {DESK_STEPS.map((_, j) => (
          <span key={j} className="h-[3px] flex-1 rounded-full" style={{ background: j <= i ? 'var(--color-accent)' : 'var(--color-neutral-800)' }} />
        ))}
      </div>
      <div className="text-[18px] font-medium leading-[1.25] text-neutral-100">{step.title}</div>
      <div className="mt-[6px] text-[14px] leading-[1.5] text-neutral-300 text-pretty">{step.body}</div>
      <div className="mt-4 flex items-center gap-2">
        {i > 0 ? (
          <button onClick={() => go(i - 1)} className="min-h-9 rounded-md px-3 text-[13.5px] font-medium text-neutral-400 hover:text-neutral-200">
            Back
          </button>
        ) : null}
        <span className="flex-1" />
        <button
          onClick={() => (last ? setPrefs({ deskTour: { on: false, i: 0 } }) : go(i + 1))}
          className="min-h-9 whitespace-nowrap rounded-md border border-accent-500 px-[14px] text-[13.5px] font-medium text-accent-100"
        >
          {last ? 'Finish' : 'Next: ' + DESK_STEPS[i + 1].title}
        </button>
      </div>
    </div>
  );
}
