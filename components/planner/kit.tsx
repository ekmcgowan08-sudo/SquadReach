'use client';
/* The planner's shell and shared pieces: the nine-link nav, the ⌘K
   palette ("G then a letter" jumps anywhere), the plan's save path with
   undo/redo, and the card every screen is built from. */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { PushBanner, Ready, Toast } from '@/components/shell/phone-shell';
import { Icon, cx } from '@/components/ui';
import { nowMs } from '@/lib/dates';
import type { Plan } from '@/lib/plan';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';

export const PLANNER_NAV = [
  { href: '/planner', label: 'Home', key: 'h', icon: 'ph ph-house' },
  { href: '/planner/prep', label: 'Prep & recap', key: 'w', icon: 'ph ph-calendar-check' },
  { href: '/planner/people', label: 'People', key: 'p', icon: 'ph ph-users-three' },
  { href: '/planner/roadmap', label: 'Roadmap', key: 'r', icon: 'ph ph-map-trifold' },
  { href: '/planner/year', label: 'Ministry year', key: 'y', icon: 'ph ph-columns' },
  { href: '/planner/season', label: 'Season & night', key: 'n', icon: 'ph ph-moon-stars' },
  { href: '/planner/coverage', label: 'Coverage', key: 'c', icon: 'ph ph-grid-four' },
  { href: '/planner/liturgical', label: 'Liturgical', key: 'l', icon: 'ph ph-circle-half' },
  { href: '/planner/settings', label: 'Settings', key: 's', icon: 'ph ph-sliders-horizontal' }
] as const;

const ACTIONS = [
  { label: 'Open the console', href: '/console', group: 'Elsewhere' },
  { label: 'Open the app on this screen', href: '/dashboard', group: 'Elsewhere' },
  { label: 'Projector', href: '/projector', group: 'Elsewhere' },
  { label: 'Run tonight’s huddle', href: '/dashboard/huddle', group: 'Tonight' },
  { label: 'Message parents', href: '/planner/people?tab=parents', group: 'Tonight' },
  { label: 'Approve swaps', href: '/planner/people', group: 'Tonight' },
  { label: 'Write tonight’s debrief', href: '/planner/season?debrief=1', group: 'Tonight' },
  { label: 'Build a report', href: '/console?tab=reports', group: 'Console' },
  { label: 'Build the season', href: '/console?tab=season', group: 'Console' },
  { label: 'Publish the plan', href: '/planner/roadmap?publish=1', group: 'Plan' },
  { label: 'Print the one-pager', href: '/planner/roadmap?print=1', group: 'Plan' },
  { label: 'Plan checks', href: '/planner/roadmap?view=checks', group: 'Plan' }
];

/* ── undo / redo for the plan ─────────────────────────────────────────── */
const hist = { undo: [] as { plan: Plan; label: string }[], redo: [] as { plan: Plan; label: string }[], v: 0 };
const subs = new Set<() => void>();
const bump = () => {
  hist.v++;
  for (const f of subs) f();
};
export function usePlanHistory() {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => hist.v,
    () => 0
  ) as number;
}

/** Change the plan. Every change is one undo step; `merge` folds typing in
 *  the same field into the step before it. */
export function usePlanSave() {
  const api = useAppApi();
  return (recipe: (p: Plan) => void, label: string, opts?: { merge?: string; log?: boolean }) => {
    const before = api().data.plan;
    const top = hist.undo[hist.undo.length - 1];
    if (!(opts?.merge && top && top.label === opts.merge)) hist.undo.push({ plan: structuredClone(before), label: opts?.merge ?? label });
    if (hist.undo.length > 80) hist.undo.shift();
    hist.redo = [];
    api().mutate((x) => {
      recipe(x.plan);
      if (opts?.log) x.plan.changes = [{ id: uid(), at: nowMs(), by: api().membership.displayName, line: label }, ...x.plan.changes].slice(0, 40);
    });
    api().emit({ kind: 'doc', key: 'plan', value: api().data.plan });
    bump();
  };
}

export function usePlanUndo() {
  const api = useAppApi();
  usePlanHistory();
  const swap = (from: typeof hist.undo, to: typeof hist.undo, verb: string) => {
    const step = from.pop();
    if (!step) return;
    to.push({ plan: structuredClone(api().data.plan), label: step.label });
    api().mutate((x) => void (x.plan = step.plan));
    api().emit({ kind: 'doc', key: 'plan', value: api().data.plan });
    api().say(verb + ': ' + step.label.toLowerCase());
    bump();
  };
  return {
    canUndo: hist.undo.length > 0,
    canRedo: hist.redo.length > 0,
    undoLabel: hist.undo[hist.undo.length - 1]?.label,
    undo: () => swap(hist.undo, hist.redo, 'Undone'),
    redo: () => swap(hist.redo, hist.undo, 'Redone')
  };
}

export function UndoButtons() {
  const u = usePlanUndo();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        u.undo();
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        u.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [u]);
  return (
    <div className="flex gap-1">
      <button onClick={u.undo} disabled={!u.canUndo} title={u.undoLabel ? 'Undo ' + u.undoLabel.toLowerCase() + ' (⌘Z)' : 'Nothing to undo'} aria-label="Undo" className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-800 text-neutral-300 disabled:opacity-40">
        <Icon name="ph ph-arrow-counter-clockwise" className="text-[14px]" />
      </button>
      <button onClick={u.redo} disabled={!u.canRedo} title="Redo (⇧⌘Z)" aria-label="Redo" className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-800 text-neutral-300 disabled:opacity-40">
        <Icon name="ph ph-arrow-clockwise" className="text-[14px]" />
      </button>
    </div>
  );
}

/* ── the shell ───────────────────────────────────────────────────────── */
export function PlannerShell({ children }: { children: ReactNode }) {
  const name = useApp((s) => s.data.config.ministryName);
  const path = usePathname();
  const router = useRouter();
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    let gAt = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((x) => !x);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'g') {
        gAt = Date.now();
        return;
      }
      if (Date.now() - gAt < 1200) {
        const hit = PLANNER_NAV.find((n) => n.key === k);
        if (hit) {
          e.preventDefault();
          router.push(hit.href);
        }
        gAt = 0;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <div className="relative min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-divider backdrop-blur-[10px]" style={{ background: 'color-mix(in srgb, var(--color-bg) 88%, #000)' }}>
        <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-5 py-[10px]">
          <Link href="/planner" className="flex-none text-[14px] font-bold leading-none tracking-[-.01em] text-neutral-300">
            SQUAD<span className="text-accent-400">RISE</span>
          </Link>
          <nav className="relative min-w-0 flex-1" aria-label="Planner">
            <div className="flex gap-[2px] overflow-x-auto" style={{ scrollbarWidth: 'none', maskImage: 'linear-gradient(90deg,#000 92%,transparent)' }}>
              {PLANNER_NAV.map((n) => {
                const on = n.href === '/planner' ? path === '/planner' : path.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={on ? 'page' : undefined}
                    className="flex min-h-9 flex-none items-center whitespace-nowrap rounded-full px-3 text-[12.5px] font-medium"
                    style={{ background: on ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)' : 'transparent', color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-400)' }}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </div>
          </nav>
          <button onClick={() => setPalette(true)} className="hidden min-h-9 flex-none items-center gap-2 rounded-full border border-neutral-800 px-3 text-[12px] text-neutral-400 md:flex">
            <Icon name="ph ph-magnifying-glass" className="text-[13px]" />
            Jump to…
            <span className="rounded border border-neutral-700 px-1 text-[10.5px]">⌘K</span>
          </button>
          <div className="hidden max-w-[220px] flex-none truncate text-[12px] text-neutral-500 lg:block">{name}</div>
          <Link href="/console" className="flex min-h-9 flex-none items-center gap-[6px] rounded-full border border-neutral-800 px-3 text-[12px] font-medium text-neutral-300">
            <Icon name="ph ph-gauge" className="text-[13px]" />
            Console
          </Link>
        </div>
      </header>
      <PushBanner />
      <Ready>
        <main className="mx-auto max-w-[1440px] px-5 pb-16 pt-5">{children}</main>
      </Ready>
      {palette ? <Palette onClose={() => setPalette(false)} /> : null}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] mx-auto h-[220px] max-w-[460px]">
        <Toast />
      </div>
      <div className="pointer-events-none fixed inset-0 z-[140] flex justify-center">
        <div id="sr-overlay" className="relative h-full w-full max-w-[560px] [&>*]:pointer-events-auto" />
      </div>
    </div>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const rows = useMemo(() => {
    const all = [...PLANNER_NAV.map((n) => ({ label: n.label, href: n.href, group: 'Go to · G then ' + n.key.toUpperCase() })), ...ACTIONS];
    const needle = q.trim().toLowerCase();
    return all.filter((r) => !needle || (r.label + ' ' + r.group).toLowerCase().includes(needle));
  }, [q]);
  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center bg-black/60 px-4 pt-[12vh]" onClick={onClose}>
      <div className="w-full max-w-[560px] overflow-hidden rounded-lg border border-neutral-800 bg-surface shadow-lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Jump to a screen or action">
        <div className="flex items-center gap-2 border-b border-divider px-4">
          <Icon name="ph ph-magnifying-glass" className="text-[15px] text-neutral-500" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setI(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setI((x) => Math.min(rows.length - 1, x + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setI((x) => Math.max(0, x - 1));
              } else if (e.key === 'Enter' && rows[i]) go(rows[i].href);
              else if (e.key === 'Escape') onClose();
            }}
            placeholder="Jump to a screen or action"
            className="min-h-[52px] flex-1 bg-transparent text-[14px] text-neutral-100 outline-none"
            aria-label="Jump to a screen or action"
          />
          <span className="rounded border border-neutral-700 px-1 text-[10.5px] text-neutral-500">esc</span>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {rows.map((r, j) => (
            <button key={r.label} onMouseEnter={() => setI(j)} onClick={() => go(r.href)} className={cx('flex w-full items-center gap-3 px-4 py-[9px] text-left', j === i && 'bg-neutral-900')}>
              <span className="flex-1 text-[13px] text-neutral-100">{r.label}</span>
              <span className="text-[11px] text-neutral-500">{r.group}</span>
            </button>
          ))}
          {!rows.length ? <div className="px-4 py-6 text-center text-[12px] text-neutral-500">No screen or action matches that.</div> : null}
        </div>
        <div className="flex gap-4 border-t border-divider px-4 py-2 text-[10.5px] text-neutral-500">
          <span>↑↓ move</span>
          <span>↵ open</span>
          <span>G then H, W, P, R, Y, N, C, L, S to jump anywhere</span>
        </div>
      </div>
    </div>
  );
}

/** A planner card with a title row. */
export function Panel({ title, meta, right, children, className }: { title: ReactNode; meta?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('sr-card flex flex-col gap-3 px-5 py-4', className)}>
      <div className="flex items-baseline gap-3">
        <h2 className="flex-1 text-[14px] font-medium leading-[1.3] text-neutral-100">{title}</h2>
        {meta ? <span className="text-[11.5px] text-neutral-500">{meta}</span> : null}
        {right}
      </div>
      {children}
    </section>
  );
}

export function PageHead({ kicker, title, sub, right }: { kicker?: string; title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-4">
      <div className="min-w-0 flex-1">
        {kicker ? <div className="text-[10.5px] font-semibold uppercase tracking-[.12em] text-neutral-500">{kicker}</div> : null}
        <h1 className="mt-1 text-[26px] font-medium leading-[1.15] text-neutral-100">{title}</h1>
        {sub ? <div className="mt-1 text-[12.5px] leading-[1.5] text-neutral-400 text-pretty">{sub}</div> : null}
      </div>
      {right}
    </div>
  );
}
