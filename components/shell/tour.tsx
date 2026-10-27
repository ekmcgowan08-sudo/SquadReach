'use client';
/* The walkthrough: one card that follows a new leader (or anyone) across the
   real screens. Steps a role can't open are skipped, so a student's tour is
   shorter than a pastor's. Position lives in this phone's preferences. */
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Icon } from '@/components/ui';
import { GATES, type GateName } from '@/lib/gates';
import { setPrefs, usePrefs } from '@/lib/prefs';
import { useApp } from '@/lib/store/provider';
import type { Persona } from '@/lib/types/domain';

const STEPS: { href: string; gate: GateName; title: string; body: string }[] = [
  { href: '/dashboard', gate: 'any', title: 'Home', body: 'Tonight first: the run of the night, what needs you, and the live standings. Tap a squad on the board for its breakdown.' },
  { href: '/dashboard/prep-week', gate: 'prep', title: 'Prep week', body: 'Reminders go out 3 days before, the day before, the morning of and an hour out. Send one early or switch it off.' },
  { href: '/dashboard/huddle', gate: 'huddle', title: 'Huddle & run sheet', body: 'Who is here, what is next, and how long the current block has been running. Open posts fill from the bench in one tap.' },
  { href: '/dashboard/score', gate: 'score', title: 'Live scoring', body: 'Points by squad, live on every phone and the projector. Coaches send points; a leader approves them.' },
  { href: '/dashboard/games', gate: 'event', title: 'Game timer', body: 'Run timed heats and head-to-heads with penalty taps. Posting the heat pays placement points.' },
  { href: '/dashboard/night-recap', gate: 'nightRecap', title: 'Recap', body: 'Tap students in or let them scan the QR. After the night, follow-ups build themselves and are due within 48 hours.' },
  { href: '/dashboard/serving', gate: 'serve', title: 'Serving & swaps', body: 'Volunteers ask for a swap here. Nothing changes until it’s approved, on the phone or the web.' },
  { href: '/dashboard/parents', gate: 'parents', title: 'Parents', body: 'Message families, nudge unsigned slips and move pickup. Parents get their own view of their child.' },
  { href: '/dashboard/follow-ups', gate: 'member', title: 'Prayer & care', body: 'Requests reach a leader before the wall. Team care is for coaches and leaders only.' },
  { href: '/dashboard/chat', gate: 'any', title: 'Chat', body: 'Announcements, the volunteer thread, and a thread for each squad.' },
  { href: '/dashboard/bible', gate: 'any', title: 'Bible & memory', body: 'This week’s verse, six ways to drill it, and one tap to log the practice.' },
  { href: '/dashboard/calendar', gate: 'any', title: 'Calendar', body: 'Every gathering, retreat and event — with RSVPs and a head count.' },
  { href: '/dashboard/more', gate: 'any', title: 'Everything else', body: 'Every other screen lives under More. Settings can replay this tour any time.' }
];

export const tourSteps = (p: Persona) => STEPS.filter((s) => GATES[s.gate](p));

export function startTour() {
  setPrefs({ tour: { on: true, i: 0 }, tourSeen: true });
}

export function TourCard() {
  const prefs = usePrefs();
  const persona = useApp((s) => s.membership.persona);
  const router = useRouter();
  const path = usePathname();
  const steps = tourSteps(persona);
  const { on, i } = prefs.tour;
  const step = steps[i];

  /* Follow the step: if the person wandered off, the card waits on its screen. */
  useEffect(() => {
    if (!on) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setPrefs({ tour: { on: false, i: 0 } });
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [on]);

  if (!on || !step || path !== step.href) return null;
  const last = i === steps.length - 1;
  const go = (n: number) => {
    setPrefs({ tour: { on: true, i: n } });
    router.push(steps[n].href);
  };
  return (
    <div role="dialog" aria-label="Walkthrough" className="absolute inset-x-3 bottom-[92px] z-[70] animate-[sr-rise_.25s_ease_both] rounded-lg border border-accent-700 bg-neutral-900 px-[18px] pb-[14px] pt-4" style={{ boxShadow: 'var(--shadow-lg)' }}>
      <div className="mb-[10px] flex items-center gap-[10px]">
        <span className="text-[10.5px] font-medium uppercase leading-none tracking-[.12em] text-accent-300">Walkthrough</span>
        <span className="text-[11.5px] leading-none text-neutral-500">
          {i + 1} of {steps.length}
        </span>
        <span className="flex-1" />
        <button aria-label="End the walkthrough" onClick={() => setPrefs({ tour: { on: false, i: 0 } })} className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-500">
          <Icon name="ph ph-x" className="text-[15px]" />
        </button>
      </div>
      <div className="mb-3 flex gap-[3px]">
        {steps.map((_, j) => (
          <span key={j} className="h-[3px] flex-1 rounded-[2px]" style={{ background: j <= i ? 'var(--color-accent)' : 'var(--color-neutral-800)' }} />
        ))}
      </div>
      <div className="text-[17px] font-medium leading-[1.25] text-neutral-100">{step.title}</div>
      <div className="mt-[6px] text-[13px] leading-[1.5] text-neutral-300 text-pretty">{step.body}</div>
      <div className="mt-[14px] flex items-center gap-2">
        {i > 0 ? (
          <button onClick={() => go(i - 1)} className="min-h-11 px-[10px] text-[13px] font-medium leading-none text-neutral-400">
            Back
          </button>
        ) : null}
        <span className="flex-1" />
        <button
          onClick={() => (last ? setPrefs({ tour: { on: false, i: 0 } }) : go(i + 1))}
          className="min-h-11 truncate rounded-md border border-accent px-[14px] text-[13px] font-medium leading-none text-accent-100"
        >
          {last ? 'Finish' : 'Next: ' + steps[i + 1].title}
        </button>
      </div>
    </div>
  );
}

/** /dashboard/walkthrough: start from step one and land on Home. */
export function WalkthroughStart() {
  const router = useRouter();
  useEffect(() => {
    startTour();
    router.replace('/dashboard');
  }, [router]);
  return null;
}
