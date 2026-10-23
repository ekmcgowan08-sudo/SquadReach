'use client';
/* The walkthrough's chapters and the setup checklist — the same component on
   the phone (More → Walkthrough) and in the Console. */
import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/ui';
import { setPrefs, usePrefs } from '@/lib/prefs';
import { useApp } from '@/lib/store/provider';
import { CHAPTERS, setupChecks } from '@/lib/walkthrough';

export function WalkthroughChapters() {
  const prefs = usePrefs();
  const d = useApp((s) => s.data);
  const [open, setOpen] = useState<string | null>(null);
  const done = prefs.walkthroughDone ?? {};
  const n = CHAPTERS.filter((c) => done[c.id]).length;
  const checks = setupChecks(d);
  const ready = checks.filter((c) => c.done).length;
  const toggle = (id: string) => setPrefs((p) => ({ walkthroughDone: { ...p.walkthroughDone, [id]: !p.walkthroughDone?.[id] } }));
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-baseline justify-between">
          <div className="text-[12px] text-neutral-400">
            {n} of {CHAPTERS.length} done · {CHAPTERS.reduce((m, c) => m + c.mins, 0)} minutes end to end
          </div>
          {n ? (
            <button onClick={() => setPrefs({ walkthroughDone: {} })} className="text-[11.5px] text-neutral-500">
              Start over
            </button>
          ) : null}
        </div>
        <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-neutral-900">
          <div className="h-full rounded-full bg-accent-500" style={{ width: Math.round((n / CHAPTERS.length) * 100) + '%' }} />
        </div>
      </div>

      <div className="sr-card overflow-hidden">
        {CHAPTERS.map((c, i) => {
          const isOpen = open === c.id;
          const isDone = !!done[c.id];
          return (
            <div key={c.id} className={i ? 'border-t border-divider' : ''}>
              <div className="flex items-center gap-3 px-[14px] py-[10px]">
                <button onClick={() => toggle(c.id)} aria-pressed={isDone} aria-label={(isDone ? 'Mark not done: ' : 'Mark done: ') + c.title} className="flex h-11 w-8 flex-none items-center justify-center">
                  <Icon name={isDone ? 'ph-fill ph-check-circle' : 'ph ph-circle'} className="text-[20px]" style={{ color: isDone ? 'var(--color-accent-300)' : 'var(--color-neutral-600)' }} />
                </button>
                <button onClick={() => setOpen(isOpen ? null : c.id)} aria-expanded={isOpen} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="tabular w-5 flex-none text-[11px]" style={{ color: isDone ? 'var(--color-accent-200)' : 'var(--color-neutral-500)' }}>
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-[13.5px] font-medium leading-[1.3] text-neutral-100">{c.title}</span>
                  <span className="flex-none text-[11px] text-neutral-500">{c.mins} min</span>
                  <Icon name={isOpen ? 'ph ph-caret-up' : 'ph ph-caret-down'} className="flex-none text-[12px] text-neutral-500" />
                </button>
              </div>
              {isOpen ? (
                <div className="flex flex-col gap-2 px-[14px] pb-[14px] pl-[58px]">
                  <div className="text-[12.5px] leading-[1.5] text-neutral-300 text-pretty">{c.why}</div>
                  <ol className="flex list-decimal flex-col gap-1 pl-4 text-[12px] leading-[1.5] text-neutral-400">
                    {c.steps.map((s) => (
                      <li key={s} className="text-pretty">
                        {s}
                      </li>
                    ))}
                  </ol>
                  <Link href={c.href} className="btn btn-secondary mt-1 self-start px-3 text-[12px]">
                    {c.go}
                    <Icon name="ph ph-arrow-right" className="ml-[6px] text-[13px]" />
                  </Link>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <div className="text-[14px] font-medium text-neutral-100">Before your first night</div>
          <div className="text-[11.5px] text-accent-200">{ready} of {checks.length} in place</div>
        </div>
        <div className="mt-1 text-[11.5px] leading-[1.5] text-neutral-500">These read the app’s real state — nothing here can say it’s set up when it isn’t.</div>
        <div className="sr-card mt-2 overflow-hidden">
          {checks.map((c, i) => (
            <Link key={c.label} href={c.href} className="flex min-h-11 items-center gap-3 px-[14px] py-[8px] sr-hover" style={{ borderTop: i ? '1px solid var(--color-divider)' : undefined, color: 'inherit' }}>
              <Icon name={c.done ? 'ph-fill ph-check-circle' : 'ph ph-circle-dashed'} className="flex-none text-[17px]" style={{ color: c.done ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }} />
              <span className="min-w-0 flex-1 text-[12.5px] text-neutral-100">{c.label}</span>
              <span className="text-[11px] text-neutral-500">{c.hint}</span>
              <Icon name="ph ph-arrow-right" className="flex-none text-[12px] text-neutral-600" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
