'use client';
/* The oversight screens: notifications, settings, the approval queue, access
   requests and the audit log. Each reads the same store the rest of the app
   writes — nothing here keeps its own copy of anything. */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { InviteSheet } from '@/components/dashboard/invite-sheet';
import { WaitingOnYou, usePendingGroups } from '@/components/screens/home';
import { AccessRow } from '@/components/screens/role-views';
import { Sheet } from '@/components/sheet';
import { startTour } from '@/components/shell/tour';
import { Btn, EmptyNote, Icon, Screen, ScreenHeader } from '@/components/ui';
import { ago } from '@/lib/dates';
import { canApprove } from '@/lib/permissions';
import { HOME_SECTIONS, NOTIF_TRIGGERS, notifOn, setPrefs, usePrefs } from '@/lib/prefs';
import { fmt, signed } from '@/lib/scoring';
import { catOf, computeNotifications, teamOf } from '@/lib/selectors';
import { useApp, useAppApi } from '@/lib/store/provider';
import { personaDef } from '@/lib/types/domain';
import type { LedgerEntry } from '@/lib/types/model';

const kicker = 'text-[10.5px] font-semibold uppercase leading-none tracking-[.1em] text-neutral-500';

function CheckRow({ on, label, hint, onClick }: { on: boolean; label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className="flex min-h-[46px] items-center gap-[11.2px] rounded-md border px-3 text-left"
      style={{ borderColor: on ? 'var(--color-accent-700)' : 'var(--color-neutral-800)', background: on ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'transparent' }}
    >
      <span
        className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border text-accent-100"
        style={{ borderColor: on ? 'var(--color-accent-500)' : 'var(--color-neutral-700)', background: on ? 'var(--color-accent-600)' : 'transparent' }}
      >
        {on ? <Icon name="ph ph-check" className="text-[11px]" /> : null}
      </span>
      <span className="flex-1">
        <span className="block text-[12.5px] font-medium leading-[1.2]" style={{ color: on ? 'var(--color-neutral-100)' : 'var(--color-neutral-300)' }}>
          {label}
        </span>
        {hint ? <span className="mt-[3px] block text-[10.5px] leading-[1.3] text-neutral-500">{hint}</span> : null}
      </span>
    </button>
  );
}

/* ── NOTIFICATIONS ─────────────────────────────────────────────────────── */
export function NotificationsScreen() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const prefs = usePrefs();
  const [settings, setSettings] = useState(false);
  const on = notifOn(d.config.notifDefaults, prefs.notifMine);
  const list = useMemo(() => computeNotifications(d, m, notifOn(d.config.notifDefaults, prefs.notifMine)), [d, m, prefs.notifMine]);

  /* A real notification from this phone, so a leader can check the device
     will actually show them before relying on it on a Wednesday night. */
  const test = async () => {
    const title = 'SquadRise is set up on this phone';
    const body = 'This is what a lead change or an approval will look like.';
    api().firePush(title, body, '/dashboard/notifications');
    if (typeof Notification === 'undefined') return;
    try {
      const perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
      if (perm !== 'granted') {
        api().say('Notifications are blocked for this site — allow them in your browser settings.');
        return;
      }
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) await reg.showNotification(title, { body, icon: '/icon-192.png', tag: 'sr-test' });
      else new Notification(title, { body, icon: '/icon-192.png' });
    } catch {
      /* the in-app banner already showed */
    }
  };

  return (
    <Screen label="Notifications">
      <ScreenHeader
        title="Notifications"
        back="/dashboard/more"
        right={
          <div className="flex items-center gap-2">
            <Btn variant="ghost" className="px-3" onClick={test}>
              Send a test
            </Btn>
            <button aria-label="Notification settings" onClick={() => setSettings(true)} className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-neutral-800 text-neutral-300">
              <Icon name="ph ph-sliders-horizontal" className="text-[14px]" />
            </button>
          </div>
        }
      />
      {list.length ? (
        <div className="sr-card overflow-hidden">
          {list.map((n, i) => (
            <Link key={i} href={n.href} className="flex items-start gap-[11px] border-t border-divider px-[15px] py-[13px] first:border-t-0 hover:bg-[color-mix(in_srgb,var(--color-accent)_7%,transparent)]">
              <Icon name={n.icon} className="mt-[1px] flex-none text-[17px] text-accent-400" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium leading-[1.3] text-neutral-200">{n.label}</div>
                <div className="mt-[3px] text-[11.5px] leading-[1.4] text-neutral-500">{n.meta}</div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="px-1 py-5 text-center text-[12px] leading-[1.6] text-neutral-500">All caught up. Nothing needs your attention right now.</div>
      )}

      <Sheet open={settings} onClose={() => setSettings(false)} label="Notification settings" z={85} maxH="85%">
        <div className="text-[17px] font-medium leading-[1.2] text-neutral-100">Notification settings</div>
        <div className="text-[11.5px] leading-[1.5] text-neutral-500 text-pretty">Choose what shows up in your notifications on this phone. Your ministry sets what’s on to begin with; what you change here is yours. Approvals you’re responsible for still appear on Home.</div>
        <div className="flex flex-col gap-[5.6px]">
          {NOTIF_TRIGGERS.map((t) => (
            <CheckRow key={t.key} on={on[t.key]} label={t.label} hint={t.hint} onClick={() => setPrefs((p) => ({ notifMine: { ...p.notifMine, [t.key]: !on[t.key] } }))} />
          ))}
        </div>
        {Object.keys(prefs.notifMine).length ? (
          <Btn variant="ghost" className="min-h-11 justify-center text-accent-300" onClick={() => setPrefs({ notifMine: {} })}>
            Back to the ministry’s settings
          </Btn>
        ) : null}
        <Btn variant="ghost" className="min-h-[46px] justify-center" onClick={() => setSettings(false)}>
          Done
        </Btn>
      </Sheet>
    </Screen>
  );
}

/* ── SETTINGS ──────────────────────────────────────────────────────────── */
export function SettingsScreen() {
  const prefs = usePrefs();
  const router = useRouter();
  return (
    <Screen label="Settings" gap={16}>
      <ScreenHeader title="Settings" back="/dashboard/more" />
      <div className="flex flex-col gap-[10px]">
        <div className={kicker}>Appearance</div>
        <div className="flex gap-2">
          {(['dark', 'light'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setPrefs({ theme: t })}
              aria-pressed={prefs.theme === t}
              className="flex min-h-[60px] flex-1 flex-col items-center justify-center gap-[6px] rounded-lg border bg-surface"
              style={{ borderColor: prefs.theme === t ? 'var(--color-accent-500)' : 'var(--color-neutral-800)' }}
            >
              <Icon name={t === 'dark' ? 'ph ph-moon' : 'ph ph-sun'} className="text-[17px] text-accent-300" />
              <span className="text-[12px] font-medium leading-none text-neutral-200">{t === 'dark' ? 'Dark' : 'Light'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sr-card px-[15px] py-1">
        <button onClick={() => setPrefs((p) => ({ reduceMotion: !p.reduceMotion }))} aria-pressed={prefs.reduceMotion} className="flex min-h-14 w-full items-center gap-[11px] text-left">
          <Icon name="ph ph-waveform" className="flex-none text-[17px] text-accent-300" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium leading-[1.2] text-neutral-100">Reduce motion</div>
            <div className="mt-[2px] text-[11px] leading-[1.4] text-neutral-500">Turns off transitions and glow effects app-wide</div>
          </div>
          <span className="relative h-[25px] w-[42px] flex-none rounded-full transition-colors" style={{ background: prefs.reduceMotion ? 'var(--color-accent-500)' : 'var(--color-neutral-700)' }}>
            <span className="absolute top-[2px] h-[21px] w-[21px] rounded-full bg-white transition-[left]" style={{ left: prefs.reduceMotion ? 19 : 2 }} />
          </span>
        </button>
      </div>

      <div className="flex flex-col gap-[10px]">
        <div className={kicker}>Home screen sections</div>
        <div className="-mt-1 text-[11.5px] leading-[1.5] text-neutral-500">Choose what shows up on your home screen. Approvals and live-game cards always show when relevant.</div>
        <div className="sr-card overflow-hidden">
          {HOME_SECTIONS.map((r, i) => {
            const on = prefs.homeSections[r.key];
            return (
              <button
                key={r.key}
                onClick={() => setPrefs((p) => ({ homeSections: { ...p.homeSections, [r.key]: !p.homeSections[r.key] } }))}
                aria-pressed={on}
                className="flex min-h-[52px] w-full items-center gap-[11px] px-[15px] text-left"
                style={{ borderTop: i ? '1px solid var(--color-divider)' : undefined }}
              >
                <Icon name={r.icon} className="flex-none text-[16px] text-accent-300" />
                <div className="flex-1 text-[13px] font-medium leading-[1.2] text-neutral-100">{r.label}</div>
                <Icon name={on ? 'ph-fill ph-check-circle' : 'ph ph-circle'} className="flex-none text-[18px]" style={{ color: on ? 'var(--color-accent-400)' : 'var(--color-neutral-600)' }} />
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => {
          startTour();
          router.push('/dashboard');
        }}
        className="sr-card sr-hover flex min-h-[52px] w-full items-center gap-[11px] px-[15px] text-left"
      >
        <Icon name="ph ph-hand-waving" className="flex-none text-[16px] text-accent-300" />
        <div className="flex-1 text-[13px] font-medium leading-[1.2] text-neutral-100">Replay onboarding</div>
        <Icon name="ph ph-caret-right" className="flex-none text-[13px] text-neutral-600" />
      </button>
    </Screen>
  );
}

/* ── APPROVALS — the queue in full, with what was decided recently ─────── */
export function ApprovalsScreen() {
  const d = useApp((s) => s.data);
  const groups = usePendingGroups();
  const decided = useMemo(
    () =>
      d.ledger
        .filter((e) => e.decidedAt && e.status !== 'pending')
        .sort((a, b) => (b.decidedAt ?? 0) - (a.decidedAt ?? 0))
        .slice(0, 20),
    [d.ledger]
  );
  return (
    <Screen label="Approvals">
      <ScreenHeader title="Approvals" back="/dashboard/more" />
      <div className="max-w-[320px] text-[12px] leading-[1.6] text-neutral-500 text-pretty">Points a coach or captain sends in wait here. Nothing counts toward a total until it’s approved, and everything you decide is in the audit log.</div>
      {groups.length ? <WaitingOnYou /> : <EmptyNote>Nothing waiting. Coach and captain requests land here the moment they’re sent.</EmptyNote>}
      {decided.length ? (
        <div className="flex flex-col gap-[8.4px]">
          <div className={kicker}>Decided recently</div>
          <div className="sr-card overflow-hidden">
            {decided.map((e) => (
              <LedgerRow key={e.id} e={e} />
            ))}
          </div>
        </div>
      ) : null}
    </Screen>
  );
}

function statusLabel(e: LedgerEntry, reversed: boolean) {
  if (reversed) return { text: 'Undone', color: 'var(--color-neutral-500)' };
  if (e.reverses) return { text: 'Reversal', color: 'var(--color-neutral-400)' };
  if (e.status === 'pending') return { text: 'Pending', color: 'var(--color-over)' };
  if (e.status === 'rejected') return { text: 'Sent back', color: 'var(--color-out)' };
  return { text: 'Counted', color: 'var(--color-accent-300)' };
}

function LedgerRow({ e, reversed = false }: { e: LedgerEntry; reversed?: boolean }) {
  const d = useApp((s) => s.data);
  const t = teamOf(d, e.team);
  const st = statusLabel(e, reversed);
  return (
    <div className="flex items-start gap-[11px] border-t border-divider px-[15px] py-[11px] first:border-t-0">
      <div className="mt-[2px] h-[30px] w-[3px] flex-none rounded-sm" style={{ background: t.color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="tabular text-[13.5px] font-semibold leading-none" style={{ color: e.amount < 0 ? 'var(--color-out)' : 'var(--color-neutral-100)' }}>
            {signed(e.amount)}
          </span>
          <span className="truncate text-[12.5px] leading-none text-neutral-300">
            {catOf(d, e.cat).label} → {t.name}
          </span>
        </div>
        <div className="mt-[5px] text-[11px] leading-[1.4] text-neutral-500 text-pretty">
          {e.by}
          {e.why ? ' · ' + e.why : ''}
          {e.student ? ' · ' + e.student : ''}
        </div>
        <div className="mt-[3px] text-[10.5px] leading-[1.3] text-neutral-500">
          {ago(e.at)}
          {e.decidedBy ? ' · decided by ' + e.decidedBy + (e.decidedAt ? ' ' + ago(e.decidedAt) : '') : ''}
        </div>
      </div>
      <span className="flex-none text-[10px] font-semibold uppercase leading-none tracking-[.08em]" style={{ color: st.color }}>
        {st.text}
      </span>
    </div>
  );
}

/* ── ACCESS REQUESTS ───────────────────────────────────────────────────── */
export function AccessRequestsScreen() {
  const d = useApp((s) => s.data);
  const [invite, setInvite] = useState(false);
  const pending = d.accessRequests.filter((r) => r.status === 'pending');
  const decided = d.accessRequests.filter((r) => r.status !== 'pending').slice(-10).reverse();
  return (
    <Screen label="Access requests">
      <ScreenHeader title="Access requests" back="/dashboard/more" />
      <div className="max-w-[320px] text-[12px] leading-[1.6] text-neutral-500 text-pretty">Anyone with your invite code can ask to join. Nobody gets in, and nobody sees a student’s name, until a leader approves them here.</div>
      <Btn variant="secondary" className="justify-center" onClick={() => setInvite(true)}>
        <Icon name="ph ph-qr-code" className="text-[15px]" /> Share the invite code · {d.config.inviteCode || '—'}
      </Btn>
      {pending.length ? (
        <div className="sr-card flex flex-col gap-[9px] px-[15px] pb-[13px] pt-[13px]">
          <div className="flex items-center gap-2">
            <Icon name="ph-fill ph-user-focus" className="text-[16px] text-accent-400" />
            <div className="flex-1 text-[13.5px] font-medium leading-none text-neutral-100">Waiting on a leader</div>
            <span className="text-[11px] leading-none text-accent-300">{pending.length}</span>
          </div>
          {pending.map((r) => (
            <div key={r.id}>
              <AccessRow id={r.id} />
              <div className="mt-[6px] text-[10.5px] leading-[1.4] text-neutral-500">
                {r.personType}
                {r.email ? ' · ' + r.email : ''} · asked {ago(r.at)}
                {r.note ? ' · “' + r.note + '”' : ''}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyNote>Nobody waiting. New requests show here and on Home.</EmptyNote>
      )}
      {decided.length ? (
        <div className="flex flex-col gap-[8.4px]">
          <div className={kicker}>Decided</div>
          <div className="sr-card overflow-hidden">
            {decided.map((r) => (
              <div key={r.id} className="flex items-center gap-[11px] border-t border-divider px-[15px] py-[11px] first:border-t-0">
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium leading-[1.2] text-neutral-200">{r.name}</div>
                  <div className="mt-[3px] text-[10.5px] leading-[1.3] text-neutral-500">{personaDef(r.requestedRole).label}</div>
                </div>
                <span className="text-[10px] font-semibold uppercase leading-none tracking-[.08em]" style={{ color: r.status === 'approved' ? 'var(--color-accent-300)' : 'var(--color-out)' }}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <InviteSheet open={invite} onClose={() => setInvite(false)} />
    </Screen>
  );
}

/* ── AUDIT LOG — every point change, and every decision, with a name ───── */
export function AuditScreen() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const [tab, setTab] = useState<'ledger' | 'activity'>('ledger');
  const [team, setTeam] = useState('');
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const reversedIds = useMemo(() => new Set(d.ledger.filter((e) => e.reverses && e.status === 'approved').map((e) => e.reverses!)), [d.ledger]);
  const ledger = useMemo(
    () =>
      [...d.ledger]
        .filter((e) => !team || e.team === team)
        .filter((e) => !needle || [e.by, e.why, e.student ?? '', catOf(d, e.cat).label, teamOf(d, e.team).name].join(' ').toLowerCase().includes(needle))
        .sort((a, b) => b.at - a.at)
        .slice(0, 150),
    [d, team, needle]
  );
  const activity = useMemo(() => [...d.activityLog].filter((a) => !needle || a.line.toLowerCase().includes(needle)).sort((a, b) => b.at - a.at).slice(0, 200), [d.activityLog, needle]);
  const counted = d.ledger.filter((e) => e.status === 'approved').length;

  return (
    <Screen label="Audit log">
      <ScreenHeader title="Audit log" back="/dashboard/more" />
      <div className="max-w-[320px] text-[12px] leading-[1.6] text-neutral-500 text-pretty">
        Totals are never stored — every number on the board is the sum of these rows. An undo is a new row, so nothing here is ever erased.
      </div>
      <div className="flex gap-[7px]">
        {(
          [
            { id: 'ledger', label: 'Points · ' + fmt(counted) },
            { id: 'activity', label: 'Activity' }
          ] as const
        ).map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            aria-pressed={tab === x.id}
            className="min-h-11 flex-1 rounded-md border text-[12.5px] font-medium leading-none"
            style={{ borderColor: tab === x.id ? 'var(--color-accent-500)' : 'var(--color-neutral-800)', background: tab === x.id ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent', color: tab === x.id ? 'var(--color-accent-100)' : 'var(--color-neutral-400)' }}
          >
            {x.label}
          </button>
        ))}
      </div>
      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'ledger' ? 'Search by name, reason, category…' : 'Search the activity log…'} aria-label="Search" />
      {tab === 'ledger' ? (
        <>
          <div className="flex gap-[6px] overflow-x-auto pb-[2px]">
            {[{ id: '', name: 'All squads', color: 'var(--color-accent-400)' }, ...d.teams].map((t) => (
              <button
                key={t.id || 'all'}
                onClick={() => setTeam(t.id)}
                aria-pressed={team === t.id}
                className="flex min-h-11 flex-none items-center gap-[6px] rounded-full border px-[11px] text-[11.5px] font-medium leading-none"
                style={{ borderColor: team === t.id ? 'var(--color-accent-600)' : 'var(--color-neutral-800)', color: team === t.id ? 'var(--color-accent-200)' : 'var(--color-neutral-400)' }}
              >
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: t.color }} />
                {t.name}
              </button>
            ))}
          </div>
          {ledger.length ? (
            <div className="sr-card overflow-hidden">
              {ledger.map((e) => (
                <LedgerRow key={e.id} e={e} reversed={reversedIds.has(e.id)} />
              ))}
            </div>
          ) : (
            <EmptyNote>No entries match.</EmptyNote>
          )}
        </>
      ) : activity.length ? (
        <div className="sr-card overflow-hidden">
          {activity.map((a) => (
            <div key={a.id} className="flex items-start gap-[11px] border-t border-divider px-[15px] py-[11px] first:border-t-0">
              <Icon name="ph ph-clock-counter-clockwise" className="mt-[2px] flex-none text-[14px] text-neutral-500" />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] leading-[1.45] text-neutral-200 text-pretty">{a.line}</div>
                <div className="mt-[3px] text-[10.5px] leading-none text-neutral-500">{ago(a.at)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyNote>{canApprove(m.persona) ? 'Nothing logged yet.' : 'The activity log is for leaders.'}</EmptyNote>
      )}
    </Screen>
  );
}
