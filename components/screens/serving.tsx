'use client';
/* SERVING & SWAPS — the next four nights. A volunteer sees the nights they
   serve, asks for a swap and says when they are in or away. The coordinator
   approves swaps, fills open spots and invites new volunteers. A swap changes
   nothing until the coordinator approves it. */
import { useState } from 'react';
import { PersonChip, Seg } from '@/components/cycle/bits';
import { useCycle } from '@/components/cycle/use-cycle';
import { Sheet } from '@/components/sheet';
import { Btn, EmptyNote, Icon, Label, Screen, ScreenHeader } from '@/components/ui';
import { atLocal, availOf, dayLabel, myNights, openSpots, servePool, weekday, whoServes } from '@/lib/cycle';
import { nowMs } from '@/lib/dates';
import { canCoordinateServing } from '@/lib/permissions';
import { uid } from '@/lib/store/app-store';
import { useAppApi } from '@/lib/store/provider';
import type { SwapRequest, VolunteerInvite } from '@/lib/types/model';

const nightLabel = (iso: string) => dayLabel(atLocal(iso, '12:00'));
const availTag = (a: 'yes' | 'no' | null) => (a === 'yes' ? 'in' : a === 'no' ? 'away' : undefined);

export function ServingScreen({ bare }: { bare?: boolean } = {}) {
  const { m, iso, nights } = useCycle();
  const coord = canCoordinateServing(m.persona);
  const [view, setView] = useState<'schedule' | 'mine'>(coord ? 'schedule' : 'mine');
  return (
    <Screen label="Serving and swaps">
      {!bare ? <ScreenHeader title="Serving" sub={'Next four ' + weekday(iso) + 's · swaps need approval'} back="/dashboard/more" /> : null}
      {coord ? (
        <Seg
          value={view}
          onChange={setView}
          options={[
            { id: 'schedule', label: 'Schedule' },
            { id: 'mine', label: 'My nights' }
          ]}
        />
      ) : null}
      {view === 'schedule' && coord ? <Coordinator nights={nights} /> : <MyNights nights={nights} />}
      {!coord ? <div className="text-[11px] leading-[1.5] text-neutral-500">The coordinator sees your availability when filling spots.</div> : null}
    </Screen>
  );
}

/* ── the coordinator ─────────────────────────────────────────────────── */
function Coordinator({ nights }: { nights: string[] }) {
  const { d, m } = useCycle();
  const api = useAppApi();
  const [pick, setPick] = useState<Record<string, string>>({});
  const [fill, setFill] = useState<{ night: string; role: string } | null>(null);
  const [inv, setInv] = useState({ name: '', contact: '', role: '' });
  const pool = servePool(d);
  const pend = d.serving.swaps.filter((s) => s.status === 'pending');
  const open = openSpots(d, nights);

  const setWho = (night: string, role: string, name: string | null) => {
    api().mutate((x) => void (x.serving.sched[night + '|' + role] = name));
    api().emit({ kind: 'serve', night, role, name });
  };
  const decide = (w: SwapRequest, ok: boolean) => {
    const to = pick[w.id] ?? w.to;
    if (ok && !to) return;
    const next: SwapRequest = { ...w, status: ok ? 'approved' : 'declined', to: ok ? to : w.to, decidedBy: m.displayName };
    api().mutate((x) => void (x.serving.swaps = x.serving.swaps.map((s) => (s.id === w.id ? next : s))));
    api().emit({ kind: 'swap', swap: next });
    if (ok && to) setWho(w.night, w.role, to);
    api().logActivity((ok ? 'Approved swap: ' + to + ' takes ' : 'Declined swap: ') + w.role.toLowerCase() + ' on ' + nightLabel(w.night) + ' from ' + w.from);
    api().say(ok ? to + ' takes ' + w.role.toLowerCase() + '. Both of them can see it now.' : 'Declined. ' + w.from + ' is still on.');
  };
  const invite = () => {
    const v: VolunteerInvite = { id: uid(), name: inv.name.trim(), contact: inv.contact.trim(), role: inv.role.trim() || 'Volunteer', status: 'sent', at: nowMs() };
    if (!v.name) return;
    api().mutate((x) => void x.serving.invites.unshift(v));
    api().emit({ kind: 'invite', invite: v });
    setInv({ name: '', contact: '', role: '' });
    api().say('Invite logged. Send them the join link from More → Invite.');
  };

  return (
    <>
      <div className="flex items-baseline justify-between">
        <Label>Swap requests</Label>
        <div className="text-[10.5px] text-neutral-500">{pend.length ? pend.length + ' waiting' : ''}</div>
      </div>
      {!pend.length ? <EmptyNote>Nothing waiting. Volunteers ask from their own Serving screen.</EmptyNote> : null}
      {pend.map((w) => {
        const chosen = pick[w.id] ?? w.to;
        return (
          <div key={w.id} className="sr-card flex flex-col gap-2 px-[14px] py-[13px]">
            <div className="text-[13.5px] font-medium leading-[1.3] text-neutral-100">
              {w.from} can’t do {w.role.toLowerCase()}
            </div>
            <div className="text-[11.5px] leading-[1.4] text-neutral-500">
              {nightLabel(w.night)} · {w.why || 'No reason given'}
            </div>
            <div className="text-[12px] leading-[1.4] text-neutral-300">
              {w.to ? 'Proposes ' + w.to + (availOf(d, w.to, w.night) === 'yes' ? ', who is available' : availOf(d, w.to, w.night) === 'no' ? ' — who said they’re away' : '') : 'Asked for anyone. Pick who takes it:'}
            </div>
            {!w.to ? (
              <div className="flex flex-wrap gap-[6px]">
                {pool
                  .filter((n) => n !== w.from)
                  .map((n) => (
                    <PersonChip key={n} name={n} on={chosen === n} tag={availTag(availOf(d, n, w.night))} onClick={() => setPick((x) => ({ ...x, [w.id]: n }))} />
                  ))}
              </div>
            ) : null}
            <div className="flex gap-2">
              <Btn className="flex-[2] justify-center text-[12px]" disabled={!chosen} onClick={() => decide(w, true)}>
                {chosen ? 'Approve · ' + chosen.split(' ')[0] : 'Approve'}
              </Btn>
              <Btn variant="ghost" className="flex-1 justify-center text-[12px] text-neutral-400" onClick={() => decide(w, false)}>
                Decline
              </Btn>
            </div>
          </div>
        );
      })}

      <Label className="mt-1">Open spots</Label>
      <div className="sr-card overflow-hidden">
        {open.map((o, i) => (
          <button key={o.night + o.role} onClick={() => setFill(o)} className="flex min-h-11 w-full items-center gap-[10px] px-[14px] py-[9px] text-left sr-hover" style={{ borderTop: i ? '1px solid var(--color-divider)' : undefined }}>
            <Icon name="ph ph-user-plus" className="flex-none text-[15px] text-accent-300" />
            <span className="flex-1 text-[12.5px] font-medium text-neutral-100">{o.role}</span>
            <span className="text-[11px] text-neutral-500">{nightLabel(o.night)}</span>
            <span className="text-[11.5px] font-medium text-accent-300">Fill</span>
          </button>
        ))}
        {!open.length ? <div className="px-[14px] py-3 text-[12px] text-neutral-500">Every spot is filled.</div> : null}
      </div>

      {nights.map((n) => (
        <div key={n} className="sr-card overflow-hidden">
          <div className="px-[14px] pb-1 pt-3">
            <Label>{nightLabel(n)}</Label>
          </div>
          {d.config.cycle.serveRoles.map((r) => {
            const who = whoServes(d, n, r);
            const away = who && availOf(d, who, n) === 'no';
            return (
              <button key={r} onClick={() => setFill({ night: n, role: r })} className="flex min-h-11 w-full items-center gap-[10px] border-t border-divider px-[14px] py-[8px] text-left sr-hover">
                <span className="w-[96px] flex-none text-[11.5px] text-neutral-500">{r}</span>
                <span className="flex-1 text-[12.5px]" style={{ color: who ? 'var(--color-neutral-100)' : 'var(--color-accent-300)' }}>
                  {who ?? 'Open'}
                </span>
                {away ? <span className="text-[10.5px] text-accent-200">said away</span> : null}
                <Icon name="ph ph-caret-right" className="text-[12px] text-neutral-600" />
              </button>
            );
          })}
        </div>
      ))}

      <Label className="mt-1">Invite a volunteer</Label>
      <div className="sr-card flex flex-col gap-2 px-[14px] py-[13px]">
        <input className="input" placeholder="Name" value={inv.name} onChange={(e) => setInv({ ...inv, name: e.target.value })} aria-label="Volunteer name" />
        <input className="input" placeholder="Phone or email" value={inv.contact} onChange={(e) => setInv({ ...inv, contact: e.target.value })} aria-label="Volunteer contact" />
        <input className="input" placeholder="What they’ll do (van driver, small group…)" value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value })} aria-label="Volunteer role" />
        <Btn className="justify-center" disabled={!inv.name.trim()} onClick={invite}>
          Log the invite
        </Btn>
        {d.serving.invites.map((v) => (
          <div key={v.id} className="flex items-center gap-2 border-t border-divider pt-2">
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium text-neutral-100">{v.name}</div>
              <div className="truncate text-[11px] text-neutral-500">
                {v.role} · {v.contact || 'no contact'}
              </div>
            </div>
            {v.status === 'accepted' ? (
              <span className="text-[11px] text-accent-300">On the team</span>
            ) : (
              <Btn
                variant="ghost"
                className="px-3 text-[11.5px]"
                onClick={() => {
                  const next = { ...v, status: 'accepted' as const };
                  api().mutate((x) => void (x.serving.invites = x.serving.invites.map((y) => (y.id === v.id ? next : y))));
                  api().emit({ kind: 'invite', invite: next });
                  api().say(v.name + ' can now be scheduled.');
                }}
              >
                Mark joined
              </Btn>
            )}
          </div>
        ))}
      </div>

      <Sheet open={!!fill} onClose={() => setFill(null)} label="Fill a spot">
        {fill ? (
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-[17px] font-medium leading-[1.2] text-neutral-100">{fill.role}</div>
              <div className="mt-1 text-[12px] text-neutral-500">{nightLabel(fill.night)} · tags show who said they’re in or away</div>
            </div>
            <div className="flex flex-wrap gap-[6px]">
              {pool.map((n) => (
                <PersonChip
                  key={n}
                  name={n}
                  on={whoServes(d, fill.night, fill.role) === n}
                  tag={availTag(availOf(d, n, fill.night))}
                  onClick={() => {
                    setWho(fill.night, fill.role, n);
                    api().say(n + ' is on ' + fill.role.toLowerCase() + ' for ' + nightLabel(fill.night) + '.');
                    setFill(null);
                  }}
                />
              ))}
            </div>
            {whoServes(d, fill.night, fill.role) ? (
              <Btn
                variant="ghost"
                className="justify-center text-neutral-400"
                onClick={() => {
                  setWho(fill.night, fill.role, null);
                  setFill(null);
                }}
              >
                Leave it open
              </Btn>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </>
  );
}

/* ── a volunteer's own nights ────────────────────────────────────────── */
function MyNights({ nights }: { nights: string[] }) {
  const { d, me } = useCycle();
  const api = useAppApi();
  const [asking, setAsking] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [why, setWhy] = useState('');
  const mine = myNights(d, me.name, nights);
  const pool = servePool(d).filter((n) => n !== me.name);

  const send = (night: string, role: string) => {
    const swap: SwapRequest = { id: uid(), from: me.name, night, role, to, why: why.trim(), status: 'pending', at: nowMs() };
    api().mutate((x) => void x.serving.swaps.unshift(swap));
    api().emit({ kind: 'swap', swap });
    api().firePush('Swap request', me.name + ' can’t do ' + role.toLowerCase() + ' on ' + nightLabel(night), '/dashboard/serving');
    setAsking(null);
    setWhy('');
    setTo(null);
    api().say('Swap request sent. Nothing changes until it’s approved.');
  };
  const cycleAvail = (night: string) => {
    const cur = availOf(d, me.name, night);
    const next = cur === null ? 'yes' : cur === 'yes' ? 'no' : null;
    api().mutate((x) => {
      if (next) x.serving.avail[me.name + '|' + night] = next;
      else delete x.serving.avail[me.name + '|' + night];
    });
    api().emit({ kind: 'avail', name: me.name, night, state: next });
  };

  return (
    <>
      <Label>{me.name.split(' ')[0]}’s nights</Label>
      {!mine.length ? <EmptyNote>You’re not on the schedule for the next four nights.</EmptyNote> : null}
      {mine.map((n) => {
        const k = n.night + '|' + n.role;
        const isAsk = asking === k;
        return (
          <div key={k} className="sr-card flex flex-col gap-2 px-[14px] py-[13px]">
            <div className="flex items-baseline gap-2">
              <span className="flex-1 text-[13.5px] font-medium text-neutral-100">{n.role}</span>
              <span className="text-[11px] text-neutral-500">{nightLabel(n.night)}</span>
            </div>
            {n.pending ? <div className="text-[11.5px] text-accent-300">Swap requested · waiting on the coordinator</div> : null}
            {!n.pending ? (
              <button
                onClick={() => {
                  setAsking(isAsk ? null : k);
                  setTo(null);
                  setWhy('');
                }}
                aria-expanded={isAsk}
                className="self-start text-[12px] font-medium text-accent-300"
              >
                {isAsk ? 'Cancel' : 'Ask for a swap'}
              </button>
            ) : null}
            {isAsk ? (
              <div className="flex flex-col gap-2">
                <div className="text-[11.5px] text-neutral-400">Who could take it?</div>
                <div className="flex flex-wrap gap-[6px]">
                  <PersonChip name="Anyone" on={to === null} onClick={() => setTo(null)} />
                  {pool.map((p) => (
                    <PersonChip key={p} name={p} on={to === p} tag={availTag(availOf(d, p, n.night))} onClick={() => setTo(p)} />
                  ))}
                </div>
                <input className="input" placeholder="Reason (optional)" value={why} onChange={(e) => setWhy(e.target.value)} aria-label="Reason" />
                <Btn className="justify-center" onClick={() => send(n.night, n.role)}>
                  Send to the coordinator
                </Btn>
              </div>
            ) : null}
          </div>
        );
      })}

      <Label className="mt-1">Availability</Label>
      <div className="sr-card overflow-hidden">
        {nights.map((n, i) => {
          const a = availOf(d, me.name, n);
          return (
            <button key={n} onClick={() => cycleAvail(n)} className="flex min-h-11 w-full items-center gap-[10px] px-[14px] py-[9px] text-left sr-hover" style={{ borderTop: i ? '1px solid var(--color-divider)' : undefined }}>
              <span className="flex-1 text-[12.5px] text-neutral-200">{nightLabel(n)}</span>
              <span
                className="rounded-full border px-[10px] py-[5px] text-[11px] font-medium leading-none"
                style={{ borderColor: a === 'yes' ? 'var(--color-accent-600)' : 'var(--color-neutral-700)', color: a === 'yes' ? 'var(--color-accent-200)' : a === 'no' ? 'var(--color-neutral-300)' : 'var(--color-neutral-500)' }}
              >
                {a === 'yes' ? 'In' : a === 'no' ? 'Away' : 'Not said'}
              </span>
            </button>
          );
        })}
      </div>
      <div className="text-[11px] leading-[1.5] text-neutral-500">Tap to switch between in, away and not said.</div>
    </>
  );
}
