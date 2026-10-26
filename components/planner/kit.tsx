'use client';
/* The planner's shell and shared pieces: the ten-link nav, the ⌘K
   palette ("G then a letter" jumps anywhere), the plan's save path with
   undo/redo, and the card every screen is built from. */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { PushBanner, Ready, Toast } from '@/components/shell/phone-shell';
import { Btn, Icon, cx } from '@/components/ui';
import { nowMs } from '@/lib/dates';
import { merge3 } from '@/lib/merge3';
import type { Health } from '@/lib/plan-insights';
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
  { href: '/planner/live', label: 'Live', key: 'm', icon: 'ph ph-broadcast' },
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
  { label: 'Print the one-pager', href: '/planner/one-pager?print=1', group: 'Plan' },
  { label: 'Plan checks', href: '/planner/roadmap?view=checks', group: 'Plan' },
  { label: 'Run ministry time', href: '/planner/live?tab=run', group: 'Tonight' },
  { label: 'Open the room screen', href: '/live/room', group: 'Tonight' }
];

/** "Move Gospel of Mark…" → "move Gospel of Mark…": names keep their capitals. */
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/* ── undo / redo for the plan ─────────────────────────────────────────── */
/* A step remembers the plan before and after it. Undo is a three-way merge
   back to `before`, so it reverts only what that step changed — never an
   edit another leader made since. */
type Step = { before: Plan; after: Plan; label: string };
const hist = { undo: [] as Step[], redo: [] as Step[], v: 0 };
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
    api().mutate((x) => {
      recipe(x.plan);
      if (opts?.log) x.plan.changes = [{ id: uid(), at: nowMs(), by: api().membership.displayName, line: label }, ...x.plan.changes].slice(0, 40);
    });
    const after = api().data.plan;
    const top = hist.undo[hist.undo.length - 1];
    if (opts?.merge && top && top.label === opts.merge) top.after = after;
    else hist.undo.push({ before, after, label: opts?.merge ?? label });
    if (hist.undo.length > 80) hist.undo.shift();
    hist.redo = [];
    api().emit({ kind: 'doc', key: 'plan', value: after });
    bump();
  };
}

export function usePlanUndo() {
  const api = useAppApi();
  usePlanHistory();
  const swap = (from: Step[], to: Step[], verb: string) => {
    const step = from.pop();
    if (!step) return;
    to.push(step);
    const back = verb === 'Undone';
    const now = api().data.plan;
    api().mutate((x) => void (x.plan = back ? merge3(step.after, step.before, now) : merge3(step.before, step.after, now)));
    api().emit({ kind: 'doc', key: 'plan', value: api().data.plan });
    api().say(verb + ': ' + lowerFirst(step.label));
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
      <button onClick={u.undo} disabled={!u.canUndo} title={u.undoLabel ? 'Undo ' + lowerFirst(u.undoLabel) + ' (⌘Z)' : 'Nothing to undo'} aria-label="Undo" className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-800 text-neutral-300 disabled:opacity-40">
        <Icon name="ph ph-arrow-counter-clockwise" className="text-[14px]" />
      </button>
      <button onClick={u.redo} disabled={!u.canRedo} title="Redo (⇧⌘Z)" aria-label="Redo" className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-800 text-neutral-300 disabled:opacity-40">
        <Icon name="ph ph-arrow-clockwise" className="text-[14px]" />
      </button>
    </div>
  );
}

/* ── the shell ───────────────────────────────────────────────────────── */
/** True while a horizontal strip's content runs past its right edge — so
 *  the edge fades only when there is more to scroll to. Re-measured when
 *  it or its links resize (fonts loading included) and as it scrolls. */
function useCutOff<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [cut, setCut] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setCut(el.scrollWidth - el.clientWidth - el.scrollLeft > 2);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const c of el.children) ro.observe(c);
    el.addEventListener('scroll', measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', measure);
    };
  }, []);
  return [ref, cut] as const;
}

export function PlannerShell({ children }: { children: ReactNode }) {
  const name = useApp((s) => s.data.config.ministryName);
  const unsaved = useApp((s) => s.unsavedDocs.includes('plan'));
  const path = usePathname();
  const router = useRouter();
  const [palette, setPalette] = useState(false);
  const [navRef, navCut] = useCutOff<HTMLDivElement>();

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
            <div ref={navRef} className="flex gap-[2px] overflow-x-auto" style={{ scrollbarWidth: 'none', maskImage: navCut ? 'linear-gradient(90deg,#000 92%,transparent)' : undefined }}>
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
          {unsaved ? (
            <span role="status" className="flex-none rounded-full border border-[oklch(0.72_0.105_66)] px-3 py-[5px] text-[11.5px] text-neutral-200" title="Kept on this screen; it saves itself, merged with anyone else’s changes, when the connection is back.">
              Not saved yet — saves when you’re back online
            </span>
          ) : null}
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

/* ── health: three statuses, each with its reason ───────────────────── */
export const HEALTH: Record<Health | 'dismissed', { label: string; color: string }> = {
  healthy: { label: 'Healthy', color: 'oklch(0.66 0.085 292)' },
  attention: { label: 'Attention needed', color: 'oklch(0.72 0.105 66)' },
  gap: { label: 'Gap', color: 'oklch(0.66 0.11 24)' },
  dismissed: { label: 'Set aside', color: 'var(--color-neutral-600)' }
};

/** Set a check, suggestion or coverage cell aside — always with a reason. */
export function DismissBox({ id, onDone }: { id: string; onDone?: () => void }) {
  const m = useApp((s) => s.membership);
  const save = usePlanSave();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="self-start text-[12px] text-neutral-500 hover:text-neutral-300">
        Set aside…
      </button>
    );
  return (
    <div className="flex gap-2">
      <input
        autoFocus
        className="input !min-h-9 flex-1 !py-0 text-[12px]"
        placeholder="Why set it aside? (recorded)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setOpen(false))}
        aria-label="Reason"
      />
      <Btn
        variant="ghost"
        className="px-3 text-[12px]"
        disabled={!reason.trim()}
        onClick={() => {
          save((x) => void x.dismissed.push({ id, reason: reason.trim(), at: nowMs(), by: m.displayName }), 'Set aside with a reason');
          setReason('');
          setOpen(false);
          onDone?.();
        }}
      >
        Set aside
      </Btn>
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className="relative h-6 w-10 flex-none rounded-full" style={{ background: on ? 'var(--color-accent-500)' : 'var(--color-neutral-800)' }}>
      <span className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all" style={{ left: on ? 19 : 3 }} />
    </button>
  );
}
