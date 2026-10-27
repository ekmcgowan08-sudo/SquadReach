'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearRecents, noteNavigation, noteVisit, recentsOwner } from '@/lib/recents';
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { switchRole } from '@/app/actions';
import { canScore } from '@/lib/permissions';
import { SheetAutopublish } from '@/components/shell/sheet-autopublish';
import { TourCard } from '@/components/shell/tour';
import { usePrefs } from '@/lib/prefs';
import { ROLE_TAB, TABS, type TabSlot } from '@/lib/screen-map';
import { chatThreadsFor } from '@/lib/selectors';
import { useApp, useAppApi, useApprovedRoles } from '@/lib/store/provider';
import { PERSONAS, type Persona } from '@/lib/types/domain';

/* ── The bottom tab bar ──────────────────────────────────────────────────
   Four slots plus Score. The second one depends on your role — it is the
   slot the Scoreboard used to hold before standings moved onto Home.
   canScore() (SCORE_ENTRY_ROLES) picks which of the two bars you get. */
interface TabDef {
  href: string;
  label: string;
  icon: string;
  match: (p: string) => boolean;
}

function TabBar() {
  const pathname = usePathname();
  const persona = useApp((s) => s.membership.persona);
  const m = useApp((s) => s.membership);
  const d = useApp((s) => s.data);
  const coachTeam = useApp((s) => s.coachTeam);
  const muted = usePrefs().chatMuted;
  /* Muted threads never count toward the badge. */
  const chatUnread = useMemo(() => chatThreadsFor(d, m, coachTeam).reduce((n, t) => n + (muted[t.id] ? 0 : d.chatUnread[t.id] || 0), 0), [d, m, coachTeam, muted]);
  const tab = (t: TabSlot): TabDef => ({ ...t, match: (x) => x.startsWith(t.href) });
  const home: TabDef = { ...TABS.home, match: (x) => x === '/dashboard' };
  const role = tab(ROLE_TAB[persona]);
  const bible = tab(TABS.bible);
  const chat = tab(TABS.chat);
  const more = tab(TABS.more);
  const scorer = canScore(persona);

  const plain = (t: TabDef, badge?: number) => {
    const on = t.match(pathname);
    return (
      <Link
        key={t.href}
        href={t.href}
        aria-current={on ? 'page' : undefined}
        className="relative flex min-h-12 min-w-[58px] flex-col items-center justify-center gap-1"
        style={{ color: on ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }}
      >
        <i aria-hidden="true" className={(on ? 'ph-fill ' : 'ph ') + t.icon} style={{ fontSize: 20 }} />
        <span className="text-[10px] font-medium leading-none">{t.label}</span>
        {badge ? (
          <>
            <span aria-hidden="true" className="absolute right-2 top-0 h-4 min-w-4 rounded-full bg-accent-700 px-1 text-center text-[9.5px] font-semibold leading-4 text-accent-100">
              {badge > 9 ? '9+' : badge}
            </span>
            <span className="sr-only">, {badge} unread</span>
          </>
        ) : null}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Main"
      className="relative flex-none border-t border-divider px-[14px] pt-[9px] backdrop-blur-md"
      style={{ background: 'color-mix(in srgb, var(--color-bg) 82%, #000)', paddingBottom: 'max(env(safe-area-inset-bottom), 14px)' }}
    >
      <div className="flex items-end justify-between">
        {plain(home)}
        {plain(role)}
        {scorer ? (
          <Link
            href="/dashboard/score"
            aria-label="Score points"
            aria-current={pathname.startsWith('/dashboard/score') ? 'page' : undefined}
            className="-mt-[26px] flex h-16 w-16 flex-col items-center justify-center gap-[2px] rounded-full border border-accent-400 text-accent-100"
            style={{
              background: 'radial-gradient(120% 120% at 50% 0%, var(--color-accent-600), var(--color-accent-800))',
              boxShadow: '0 0 30px -6px var(--color-accent-600)'
            }}
          >
            <i aria-hidden="true" className="ph-fill ph-lightning" style={{ fontSize: 21 }} />
            <span className="text-[9.5px] font-semibold leading-none tracking-[.04em]">SCORE</span>
          </Link>
        ) : (
          plain(bible)
        )}
        {plain(chat, chatUnread)}
        {plain(more)}
      </div>
    </nav>
  );
}

/* ── No signal ───────────────────────────────────────────────────────────
   A persistent banner, not a toast: a coach has to know BEFORE they tap. */
function OfflineBanner() {
  const offline = useApp((s) => !s.netOnline || s.offlineSim);
  const held = useApp((s) => s.outbox.length);
  if (!offline) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[120] flex items-center gap-2 border-b border-accent-700 px-[18px] py-[9px]"
      style={{ background: 'color-mix(in srgb, var(--color-accent) 22%, var(--color-neutral-900))' }}
    >
      <i aria-hidden="true" className="ph-fill ph-cloud-slash flex-none text-[15px] text-accent-200" />
      <div className="flex-1 text-[11.5px] font-medium leading-[1.3] text-accent-100 text-pretty">
        {held ? 'No signal · ' + held + ' held on this phone' : 'No signal · what you award is held here'}
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useApp((s) => s.toast);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-[18px] bottom-[112px] z-[70]">
      {toast ? (
        <div
          key={toast.key}
          className="flex items-center gap-[10px] rounded-md bg-neutral-900 px-[14px] py-3 animate-sr-rise"
          style={{ boxShadow: 'var(--shadow-md), inset 0 0 0 1px var(--color-accent-700)' }}
        >
          <i aria-hidden="true" className="ph-fill ph-lightning text-[16px] text-accent-300" />
          <div className="flex-1 text-[12.5px] font-medium leading-[1.4] text-neutral-100">{toast.msg}</div>
        </div>
      ) : null}
    </div>
  );
}

export function PushBanner() {
  const push = useApp((s) => s.push);
  const name = useApp((s) => s.data.config.ministryName);
  const router = useRouter();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!push) return;
    const a = requestAnimationFrame(() => setShown(true));
    const b = setTimeout(() => setShown(false), 4200);
    return () => {
      cancelAnimationFrame(a);
      clearTimeout(b);
      setShown(false);
    };
  }, [push]);
  if (!push) return null;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Open notification"
      onClick={() => push.href && router.push(push.href)}
      onKeyDown={(e) => e.key === 'Enter' && push.href && router.push(push.href)}
      className="absolute inset-x-2 z-[200] flex cursor-pointer items-start gap-[10px] rounded-[16px] px-[13px] py-[11px] backdrop-blur-xl"
      style={{ top: shown ? 8 : -100, transition: 'top .35s cubic-bezier(.32,.9,.4,1)', background: 'rgba(28,31,63,.92)', boxShadow: 'var(--shadow-lg)' }}
    >
      <div className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[7px] bg-accent-700">
        <i aria-hidden="true" className="ph-fill ph-lightning text-[14px] text-accent-100" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-[6px]">
          <span className="text-[11px] font-semibold leading-none text-neutral-100">{name}</span>
          <span className="text-[10px] leading-none text-neutral-500">now</span>
        </div>
        <div className="mt-[2px] text-[12.5px] font-medium leading-[1.3] text-neutral-100">{push.title}</div>
        <div className="mt-[1px] text-[11.5px] leading-[1.3] text-neutral-400">{push.body}</div>
      </div>
    </div>
  );
}

/* ── The role sheet (tap the avatar on Home) ─────────────────────────────
   Every account can hold several roles. The two proposal personas are
   labelled as such so nobody builds against them by accident. */
function RoleSheet() {
  const open = useApp((s) => s.roleSheetOpen);
  const persona = useApp((s) => s.membership.persona);
  const mode = useApp((s) => s.membership.mode);
  const api = useAppApi();
  const approved = useApprovedRoles();
  const router = useRouter();
  const [pending, start] = useTransition();
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && api().setRoleSheet(false);
    window.addEventListener('keydown', onKey);
    sheetRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, api]);

  if (!open) return null;
  const rows = PERSONAS.filter((p) => mode === 'demo' || p.maps);
  const choose = (id: Persona) => {
    if (id === persona) return api().setRoleSheet(false);
    if (!approved.includes(id)) {
      api().say('That role needs the Youth Pastor’s approval. Ask from More → Access requests.');
      return;
    }
    start(async () => {
      const res = await switchRole(id);
      if (!res.ok) {
        api().say(res.error ?? 'Could not switch.');
        return;
      }
      clearRecents();
      api().setRoleSheet(false);
      router.push('/dashboard');
      router.refresh();
    });
  };

  return (
    <div className="absolute inset-0 z-[150] flex flex-col justify-end" style={{ background: 'rgba(6,7,13,.6)', animation: 'sr-fade .2s both' }} onClick={() => api().setRoleSheet(false)}>
      <div
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Switch role"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[86%] overflow-auto rounded-t-[22px] bg-surface px-[18px] pb-[max(env(safe-area-inset-bottom),18px)] pt-[22px]"
        style={{ boxShadow: 'var(--shadow-lg)', animation: 'sr-sheet .28s cubic-bezier(.22,.85,.34,1) both' }}
      >
        <div className="text-[18px] font-medium text-neutral-100">Switch role</div>
        <div className="mt-[6px] text-[12px] leading-[1.55] text-neutral-400 text-pretty">
          Every account can hold several roles. Locked roles need the Youth Pastor’s approval — request one and it shows pending until they say yes.
        </div>
        <div className="mt-[14px] flex flex-col gap-2">
          {rows.map((r) => {
            const on = r.id === persona;
            const ok = approved.includes(r.id);
            return (
              <button
                key={r.id}
                disabled={pending}
                onClick={() => choose(r.id)}
                className="flex min-h-[58px] items-center gap-3 rounded-md border px-3 text-left"
                style={{
                  borderColor: on ? 'var(--color-accent-500)' : 'var(--color-neutral-800)',
                  background: on ? 'color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))' : 'transparent'
                }}
              >
                <i aria-hidden="true" className={r.icon + ' flex-none text-[18px] text-neutral-300'} />
                <div className="min-w-0 flex-1 py-2">
                  <div className="text-[13.5px] font-medium text-neutral-100">
                    <span aria-hidden="true">{r.emoji} </span>
                    {r.label}
                  </div>
                  <div className="mt-[2px] text-[11px] text-neutral-500">{on ? 'Current' : ok ? 'Approved · tap to switch' : 'Not approved'}</div>
                  <div className="mt-[2px] text-[10.5px] font-medium text-neutral-400">
                    {r.maps ? 'role: ' + r.maps : 'preview only · no account role'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <button onClick={() => api().setRoleSheet(false)} className="mt-2 min-h-11 w-full text-[13px] font-medium text-accent-300">
          Done
        </button>
      </div>
    </div>
  );
}

function Booting() {
  return (
    <div className="flex flex-1 flex-col gap-[14px] px-[18px] pt-[10px]" aria-busy="true" aria-label="Loading">
      <div className="h-3 w-40 rounded sr-shimmer" />
      <div className="h-8 w-56 rounded sr-shimmer" />
      <div className="h-40 rounded-lg sr-shimmer" />
      <div className="h-56 rounded-lg sr-shimmer" />
    </div>
  );
}

/** Hold the screen until the ministry has loaded on this device. */
export function Ready({ children }: { children: ReactNode }) {
  const ready = useApp((s) => s.ready);
  return ready ? <>{children}</> : <Booting />;
}

/* ── The frame ───────────────────────────────────────────────────────────
   Full-bleed on a phone. On a wider screen the app sits in a phone-width
   column, because it is the phone shape of the same data — the console at
   /console is the desktop shape. */
export function PhoneShell({ children }: { children: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const who = useApp((s) => recentsOwner(s.membership));
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    noteNavigation(pathname);
    noteVisit(who, pathname);
  }, [pathname, who]);

  return (
    <div
      className="flex min-h-dvh justify-center"
      style={{ background: 'radial-gradient(120% 80% at 50% 0%, var(--color-neutral-800) 0%, var(--color-bg) 70%)' }}
    >
      <div className="relative flex h-dvh w-full max-w-[440px] flex-col overflow-hidden bg-bg sm:my-0 sm:border-x sm:border-neutral-800">
        <PushBanner />
      <SheetAutopublish />
        <div ref={scroller} className="flex flex-1 flex-col overflow-y-auto overscroll-contain" style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)' }}>
          <OfflineBanner />
          <Ready>{children}</Ready>
        </div>
        <Toast />
        <TourCard />
        <TabBar />
        {/* Bottom sheets and overlays portal here so they cover the phone,
            not the scrolling screen under them. */}
        <div id="sr-overlay" className="pointer-events-none absolute inset-0 z-[140] [&>*]:pointer-events-auto" />
        <RoleSheet />
      </div>
    </div>
  );
}

