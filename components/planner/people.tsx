'use client';
/* PLANNER · PEOPLE — volunteers and parents from a desk. Volunteers: who
   serves when as a table of names (a spot nobody holds says Open; someone
   who said they're away is flagged), everyone's availability as a grid,
   swaps to decide, and invites. Parents: a message to families, every
   permission slip with who has signed, tonight's pickup, what a family
   actually sees, and the family directory. */
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { FamilyTonightCard } from '@/components/cycle/family-card';
import { useCycle } from '@/components/cycle/use-cycle';
import { TitleSwitch } from '@/components/planner/kit';
import { FamilySheet, NewSlipSheet, useParentActions } from '@/components/screens/parents';
import { Btn, Icon, cx } from '@/components/ui';
import { atLocal, audienceKids, audienceLabel, availOf, clock, dayLabel, familyView, servePool, slipDueLabel, slipsView, weekday, when, whoServes } from '@/lib/cycle';
import { isoDay, nowMs } from '@/lib/dates';
import { uid } from '@/lib/store/app-store';
import { useAppApi } from '@/lib/store/provider';
import type { SwapRequest, VolunteerInvite } from '@/lib/types/model';

const COUNT = ['none', 'one', 'two', 'three', 'four', 'five', 'six'];
const nightLabel = (iso: string) => dayLabel(atLocal(iso, '12:00'));
const shortDay = (iso: string) => nightLabel(iso).replace(/^\w+, /, '');
const shortName = (n: string) => {
  const parts = n.trim().split(/\s+/);
  return parts.length > 1 ? parts[0] + ' ' + parts[parts.length - 1][0] + '.' : n;
};

export function PeopleDesk() {
  const { d, nights } = useCycle();
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get('tab') === 'parents' ? 'parents' : 'volunteers';
  const families = Object.keys(d.families).length;
  return (
    <div className="flex flex-col gap-5">
      <TitleSwitch
        kicker={tab === 'parents' ? families + (families === 1 ? ' family · ' : ' families · ') + d.config.ministryName : servePool(d).length + ' volunteers · next ' + (COUNT[nights.length] ?? nights.length) + ' ' + (nights[0] ? weekday(nights[0]) + 's' : 'nights')}
        value={tab}
        options={[
          { id: 'volunteers', label: 'Volunteers' },
          { id: 'parents', label: 'Parents' }
        ]}
        onChange={(v) => router.replace('/planner/people' + (v === 'parents' ? '?tab=parents' : ''))}
        right={
          <div className="text-right text-[12.5px] leading-[1.5] text-neutral-400">
            Changes here show on the phones within a second.
            <br />
            {tab === 'parents' ? 'Families read everything on their own private link.' : 'Volunteers ask for swaps from the app; you approve them here.'}
          </div>
        }
      />
      {tab === 'parents' ? <Parents /> : <Volunteers />}
    </div>
  );
}

const Card = ({ title, meta, children, className }: { title: string; meta?: string; children: React.ReactNode; className?: string }) => (
  <section className={cx('sr-card flex flex-col gap-3 px-6 py-5', className)}>
    <div className="flex items-baseline gap-3">
      <h2 className="flex-1 text-[19px] font-medium text-neutral-100">{title}</h2>
      {meta ? <span className="text-[12.5px] text-neutral-500">{meta}</span> : null}
    </div>
    {children}
  </section>
);

/* ── volunteers ────────────────────────────────────────────────────────── */
function Volunteers() {
  const { d, m, nights, iso } = useCycle();
  const api = useAppApi();
  const pool = servePool(d);
  const roles = d.config.cycle.serveRoles;
  const pend = d.serving.swaps.filter((s) => s.status === 'pending');
  const [pick, setPick] = useState<Record<string, string>>({});
  const [inv, setInv] = useState({ name: '', contact: '', role: '' });
  const setWho = (night: string, role: string, name: string | null) => {
    api().mutate((x) => void (x.serving.sched[night + '|' + role] = name));
    api().emit({ kind: 'serve', night, role, name });
  };
  const cycle = (name: string, night: string) => {
    const cur = availOf(d, name, night);
    const next = cur === null ? 'yes' : cur === 'yes' ? 'no' : null;
    api().mutate((x) => {
      if (next) x.serving.avail[name + '|' + night] = next;
      else delete x.serving.avail[name + '|' + night];
    });
    api().emit({ kind: 'avail', name, night, state: next });
  };
  const decide = (w: SwapRequest, ok: boolean) => {
    const to = pick[w.id] ?? w.to;
    if (ok && !to) return api().say('Pick who takes it first.');
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
  const joined = (v: VolunteerInvite) => {
    const next = { ...v, status: 'accepted' as const };
    api().mutate((x) => void (x.serving.invites = x.serving.invites.map((y) => (y.id === v.id ? next : y))));
    api().emit({ kind: 'invite', invite: next });
    api().say(v.name + ' can now be scheduled.');
  };
  const openSpots = nights.reduce((n, night) => n + roles.filter((r) => !whoServes(d, night, r)).length, 0);
  const head = (n: string) => shortDay(n) + (n === iso ? ' · tonight' : '');
  const cols = { gridTemplateColumns: '120px repeat(' + nights.length + ', minmax(0, 1fr))' };

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        <Card title="Who serves when" meta={openSpots ? openSpots + (openSpots === 1 ? ' open spot' : ' open spots') : 'every spot filled'}>
          <div className="grid gap-2" style={cols}>
            <span />
            {nights.map((n) => (
              <span key={n} className="text-[12.5px] font-medium text-neutral-200">
                {head(n)}
              </span>
            ))}
            {roles.map((r) => (
              <div key={r} className="contents">
                <span className="self-center text-[13.5px] text-neutral-300">{r}</span>
                {nights.map((n) => {
                  const who = whoServes(d, n, r);
                  const away = !!who && availOf(d, who, n) === 'no';
                  return (
                    /* The cell shows the name; the picker sits over it, invisible, so it is still a native select. */
                    <label key={n} className={cx('relative flex min-h-11 items-center gap-2 rounded-md border px-3 text-[13.5px]', who ? 'border-neutral-800 bg-neutral-900 text-neutral-100' : 'border-accent-600 font-medium text-accent-100')} title={who ? who + (away ? ' said they’re away' : '') : 'Nobody yet'}>
                      <span className="min-w-0 flex-1 truncate">{who ? shortName(who) : 'Open'}</span>
                      {away ? <Icon name="ph ph-warning" className="flex-none text-[15px] text-accent-200" /> : null}
                      <select className="absolute inset-0 cursor-pointer opacity-0" value={who ?? ''} onChange={(e) => setWho(n, r, e.target.value || null)} aria-label={r + ' on ' + nightLabel(n)}>
                        <option value="">Leave open</option>
                        {pool.map((p) => (
                          <option key={p} value={p}>
                            {p}
                            {availOf(d, p, n) === 'no' ? ' (away)' : availOf(d, p, n) === 'yes' ? ' (in)' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Availability" meta="Click to cycle: in, away, not said">
          <div className="grid gap-2" style={cols}>
            <span />
            {nights.map((n) => (
              <span key={n} className="text-[12.5px] font-medium text-neutral-200">
                {head(n)}
              </span>
            ))}
            {pool.map((p) => (
              <div key={p} className="contents">
                <span className="self-center truncate text-[13.5px] text-neutral-300">{shortName(p)}</span>
                {nights.map((n) => {
                  const a = availOf(d, p, n);
                  return (
                    <button
                      key={n}
                      onClick={() => cycle(p, n)}
                      aria-label={p + ' on ' + nightLabel(n) + ': ' + (a === 'yes' ? 'in' : a === 'no' ? 'away' : 'not said')}
                      className={cx('flex min-h-10 items-center justify-center gap-[6px] rounded-md border text-[12.5px]', a === 'yes' ? 'border-accent-600 text-accent-100' : 'border-neutral-800', a === 'no' ? 'text-neutral-300' : a === null ? 'text-neutral-600' : '')}
                      style={{ background: a === 'yes' ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)' : undefined }}
                    >
                      {a === 'yes' ? <Icon name="ph ph-check" className="text-[13px]" /> : a === 'no' ? <Icon name="ph ph-x" className="text-[13px]" /> : null}
                      {a === 'yes' ? 'In' : a === 'no' ? 'Away' : '–'}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-5">
        <Card title="Swap requests" meta={pend.length ? pend.length + ' waiting' : ''}>
          {!pend.length ? <div className="text-[13px] text-neutral-500">Nothing waiting. Requests from the phone land here.</div> : null}
          {pend.map((w, i) => {
            const chosen = pick[w.id] ?? w.to;
            const proposed = w.to && !pick[w.id];
            const others = pool.filter((n) => n !== w.from).sort((a, b) => Number(availOf(d, b, w.night) === 'yes') - Number(availOf(d, a, w.night) === 'yes'));
            return (
              <div key={w.id} className={cx('flex flex-col gap-2 pb-4', i > 0 && 'border-t border-divider pt-4')}>
                <div className="flex items-baseline gap-3">
                  <span className="flex-1 text-[15px] font-medium text-neutral-100">
                    {shortName(w.from)} can’t do {w.role.toLowerCase()}
                  </span>
                  <span className="text-[12.5px] text-neutral-500">{nightLabel(w.night)}</span>
                </div>
                {w.why ? <div className="text-[13.5px] text-neutral-300">“{w.why.replace(/\.$/, '')}.”</div> : null}
                {proposed ? (
                  <div className="text-[13px] text-neutral-400">
                    Proposes {shortName(w.to!)}
                    {availOf(d, w.to!, w.night) === 'yes' ? ', who marked themselves available.' : '.'}
                  </div>
                ) : (
                  <>
                    <div className="text-[13px] text-neutral-400">{w.to ? 'Or pick someone else:' : 'Asked for anyone. Pick who takes it:'}</div>
                    <div className="flex flex-wrap gap-2">
                      {others.map((n) => {
                        const on = chosen === n;
                        return (
                          <button
                            key={n}
                            onClick={() => setPick((x) => ({ ...x, [w.id]: n }))}
                            aria-pressed={on}
                            className={cx('min-h-9 rounded-full border px-3 text-[12.5px]', on ? 'border-accent-500 text-accent-100' : 'border-neutral-700 text-neutral-300')}
                            style={{ background: on ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)' : undefined }}
                          >
                            {shortName(n)}
                            {availOf(d, n, w.night) === 'yes' ? <span className="text-neutral-500"> · in</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Btn className="px-4 text-[13px]" disabled={!chosen} onClick={() => decide(w, true)}>
                    {chosen ? 'Approve · ' + shortName(chosen) + ' takes it' : 'Approve'}
                  </Btn>
                  <Btn variant="ghost" className="px-3 text-[13px] text-accent-300" onClick={() => decide(w, false)}>
                    Decline
                  </Btn>
                  {proposed ? (
                    <Btn variant="ghost" className="px-3 text-[13px] text-neutral-400" onClick={() => setPick((x) => ({ ...x, [w.id]: '' }))}>
                      Someone else
                    </Btn>
                  ) : null}
                </div>
              </div>
            );
          })}
        </Card>

        <Card title="Invite a volunteer">
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Name" value={inv.name} onChange={(e) => setInv({ ...inv, name: e.target.value })} aria-label="Volunteer name" />
            <input className="input" placeholder="Phone or email" value={inv.contact} onChange={(e) => setInv({ ...inv, contact: e.target.value })} aria-label="Volunteer contact" />
          </div>
          <div className="flex gap-2">
            <input className="input flex-1" list="sr-serve-roles" placeholder="What they’ll do" value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value })} aria-label="Volunteer role" />
            <datalist id="sr-serve-roles">
              {[...roles, 'Small group leader', 'Media'].map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
            <Btn variant="secondary" className="px-4" disabled={!inv.name.trim()} onClick={invite}>
              Log the invite
            </Btn>
          </div>
          {d.serving.invites.map((v) => (
            <div key={v.id} className="flex items-center gap-3 border-t border-divider pt-3">
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium text-neutral-100">{v.name}</div>
                <div className="truncate text-[12px] text-neutral-500">
                  {v.role} · {v.contact || 'no contact'} · sent {new Date(v.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
              <span className={cx('rounded-[5px] px-2 py-[3px] text-[11.5px] font-medium', v.status === 'accepted' ? 'bg-accent-800 text-accent-100' : 'bg-neutral-800 text-neutral-300')}>{v.status === 'accepted' ? 'Joined' : 'Invited'}</span>
              {v.status !== 'accepted' ? (
                <Btn variant="ghost" className="px-2 text-[12.5px] text-accent-300" onClick={() => joined(v)}>
                  Mark joined
                </Btn>
              ) : null}
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

/* ── parents ───────────────────────────────────────────────────────────── */
function Parents() {
  const { d, iso, night, t, today, now } = useCycle();
  const { send, shiftPickup, paper } = useParentActions();
  const [to, setTo] = useState('all');
  const [text, setText] = useState('');
  const [all, setAll] = useState<Record<string, boolean>>({});
  const [newSlip, setNewSlip] = useState(false);
  const [famQ, setFamQ] = useState('');
  const [fam, setFam] = useState<string | null>(null);
  const kids = d.roster.filter((s) => d.families[s.name]);
  const [kid, setKid] = useState(kids.find((s) => s.name === 'Ellison Reid')?.name ?? kids[0]?.name ?? '');
  const v = kid ? familyView(d, kid, now) : null;
  const views = slipsView(d);
  const reach = audienceKids(d, to).length;
  const base = t.pickup - night.pickupShift * 60_000;
  const famList = useMemo(() => {
    const n = famQ.trim().toLowerCase();
    return d.roster
      .filter((s) => !n || s.name.toLowerCase().includes(n) || (d.families[s.name]?.guardian ?? '').toLowerCase().includes(n))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [d.roster, d.families, famQ]);
  const shown = famList.slice(0, famQ ? 60 : 12);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,0.8fr)]">
        <Card title="Message parents">
          <label className="flex flex-col gap-[6px] text-[12.5px] text-neutral-400">
            To
            <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="all">All families ({audienceKids(d, 'all').length})</option>
              {d.slips.map((s) => (
                <option key={s.id} value={'slip:' + s.id}>
                  {audienceLabel(d, 'slip:' + s.id)} ({audienceKids(d, 'slip:' + s.id).length})
                </option>
              ))}
            </select>
          </label>
          <textarea className="input min-h-[110px] py-2 text-[13.5px] leading-[1.5]" placeholder="Write to families" value={text} onChange={(e) => setText(e.target.value)} aria-label="Message to families" />
          <div className="flex items-center gap-3">
            <Btn className="px-5" disabled={!text.trim()} onClick={() => send(to, text.trim()) && setText('')}>
              Send
            </Btn>
            <span className="text-[12.5px] text-neutral-400">
              Goes to {reach} {reach === 1 ? 'family' : 'families'}, on their link
            </span>
          </div>
          <div className="mt-2 text-[11px] font-semibold uppercase tracking-[.12em] text-neutral-500">Sent</div>
          {!d.parentMsgs.length ? <div className="text-[13px] text-neutral-500">Nothing sent yet.</div> : null}
          {d.parentMsgs.slice(0, 5).map((x) => (
            <div key={x.id} className="flex flex-col gap-[6px] border-b border-divider pb-3">
              <div className="text-[14px] leading-[1.5] text-neutral-100 text-pretty">{x.text}</div>
              <div className="flex gap-3 text-[12px] text-neutral-500">
                <span className="flex-1">
                  {audienceLabel(d, x.to)} · {when(x.at)}
                </span>
                <span>
                  Read by {x.kids.filter((k) => x.reads[k]).length} of {x.kids.length}
                </span>
              </div>
            </div>
          ))}
        </Card>

        <section className="sr-card flex flex-col gap-4 px-6 py-5">
          <div className="flex items-baseline gap-3">
            <h2 className="flex-1 text-[19px] font-medium text-neutral-100">Permission slips</h2>
            <Btn variant="ghost" className="px-2 text-[13px] text-accent-300" onClick={() => setNewSlip(true)}>
              + New slip
            </Btn>
          </div>
          {!views.length ? <div className="text-[13px] text-neutral-500">No slips out. Add one for a trip, a van ride or a retreat.</div> : null}
          {views.map((sv) => {
            const un = sv.total - sv.signedN;
            const list = all[sv.slip.id] ? sv.kids : sv.kids.slice(0, 14);
            return (
              <div key={sv.slip.id} className="flex flex-col gap-2">
                <div className="flex items-baseline gap-3">
                  <span className="flex-1 text-[15px] font-medium text-neutral-100">{sv.slip.title}</span>
                  <span className="text-[12.5px] text-neutral-500">{slipDueLabel(sv.slip, today)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-neutral-800">
                    <div className="h-full rounded-full bg-accent-500" style={{ width: (sv.total ? (sv.signedN / sv.total) * 100 : 0) + '%' }} />
                  </div>
                  <span className="tabular text-[12.5px] text-neutral-400">
                    {sv.signedN} of {sv.total} signed
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4">
                  {list.map((k) => (
                    <div key={k.name} className="flex min-h-10 items-center gap-2 border-b border-divider" title={k.signed ? 'Signed · ' + k.by : k.guardian || 'No guardian on file'}>
                      <Icon name={k.signed ? 'ph ph-check-circle' : 'ph ph-circle'} className={cx('flex-none text-[15px]', k.signed ? 'text-accent-300' : 'text-neutral-600')} />
                      <span className={cx('min-w-0 flex-1 truncate text-[13px]', k.signed ? 'text-neutral-100' : 'text-neutral-400')}>{k.name}</span>
                      <button onClick={() => paper(sv.slip.id, k.name, !k.signed)} className="min-h-8 flex-none px-1 text-[11.5px] text-neutral-500 hover:text-neutral-200" aria-label={(k.signed ? 'Undo the signature for ' : 'Mark a paper slip for ') + k.name}>
                        {k.signed ? (k.by?.startsWith('Paper') ? 'Undo' : '') : 'Paper'}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {un ? (
                    <Btn variant="secondary" className="px-4 text-[13px]" onClick={() => send('unsigned:' + sv.slip.id, 'Reminder: the slip for ' + sv.slip.title + ' is still unsigned. ' + slipDueLabel(sv.slip, today) + '. You can sign it from your family link.')}>
                      Nudge {un} {un === 1 ? 'family' : 'families'}
                    </Btn>
                  ) : (
                    <span className="text-[12.5px] text-accent-300">Everyone has signed.</span>
                  )}
                  {sv.kids.length > 14 ? (
                    <Btn variant="ghost" className="px-3 text-[12.5px] text-neutral-400" onClick={() => setAll((x) => ({ ...x, [sv.slip.id]: !x[sv.slip.id] }))}>
                      {all[sv.slip.id] ? 'Show fewer' : 'Show all ' + sv.kids.length}
                    </Btn>
                  ) : null}
                </div>
              </div>
            );
          })}
        </section>

        <section className="sr-card flex flex-col gap-3 px-6 py-5">
          <h2 className="text-[19px] font-medium text-neutral-100">Pickup tonight</h2>
          <div className="flex items-center justify-between gap-2">
            <button aria-label="Five minutes earlier" onClick={() => shiftPickup(-5)} className="flex h-11 w-11 items-center justify-center rounded-full text-accent-300 hover:bg-neutral-800">
              <Icon name="ph ph-minus" className="text-[16px]" />
            </button>
            <span className="tabular text-[34px] font-medium leading-none text-neutral-100">{clock(t.pickup)}</span>
            <button aria-label="Five minutes later" onClick={() => shiftPickup(5)} className="flex h-11 w-11 items-center justify-center rounded-full text-accent-300 hover:bg-neutral-800">
              <Icon name="ph ph-plus" className="text-[16px]" />
            </button>
          </div>
          <div className="text-[13.5px] text-neutral-400">
            {nightLabel(iso)} · at the {d.config.cycle.pickupPlace}
          </div>
          <Btn variant="secondary" className="justify-center" disabled={t.pickup === base} onClick={() => send('all', 'Pickup tonight is at ' + clock(t.pickup) + ' at the ' + d.config.cycle.pickupPlace + '.')}>
            Tell all families
          </Btn>
          <div className="my-2 h-px bg-divider" />
          <h3 className="text-[15px] font-medium text-neutral-100">What parents see</h3>
          <p className="text-[13px] leading-[1.6] text-neutral-400 text-pretty">Tonight’s plan and pickup, their child’s slips and attendance, and your messages. Prayer requests, notes and other kids stay out of it.</p>
          <select className="input" value={kid} onChange={(e) => setKid(e.target.value)} aria-label="Preview a family">
            {kids.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name} — {d.families[s.name].guardian || 'no guardian named'}
              </option>
            ))}
          </select>
          {v ? <FamilyTonightCard v={v} onSign={() => undefined} onRead={() => undefined} /> : <div className="text-[12.5px] text-neutral-500">No families on file yet.</div>}
          {kid && d.families[kid]?.token ? (
            <a href={'/f/' + d.families[kid].token} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-[6px] text-[13px] font-medium text-neutral-100">
              Open {kid.split(' ')[0]}’s family link
              <Icon name="ph ph-arrow-up-right" className="text-[13px]" />
            </a>
          ) : null}
          <div className="text-[11.5px] text-neutral-500">A preview — signing here does nothing. Families use their own link.</div>
        </section>
      </div>

      <section className="sr-card flex flex-col gap-3 px-6 py-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="flex-1 text-[19px] font-medium text-neutral-100">Families</h2>
          <input className="input w-[320px]" placeholder="Find a student or guardian" value={famQ} onChange={(e) => setFamQ(e.target.value)} aria-label="Find a family" />
        </div>
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] text-[13px]">
          {['Student', 'Guardian', 'Phone or email', ''].map((h, i) => (
            <span key={i} className="pb-2 pr-4 text-[11.5px] font-medium uppercase tracking-[.08em] text-neutral-500">
              {h}
            </span>
          ))}
          {shown.map((s) => {
            const f = d.families[s.name];
            return (
              <div key={s.id} className="contents">
                <span className="flex min-h-11 items-center truncate border-t pr-4 border-divider text-neutral-100">{s.name}</span>
                <span className="flex min-h-11 items-center truncate border-t pr-4 border-divider text-neutral-300">{f?.guardian || (f ? 'Not named' : 'No family on file')}</span>
                <span className="flex min-h-11 items-center truncate border-t pr-4 border-divider text-neutral-400">{f?.contact || '—'}</span>
                <span className="flex min-h-11 items-center border-t border-divider">
                  <Btn variant="ghost" className="px-3 text-[12.5px] text-accent-300" onClick={() => setFam(s.name)} ariaLabel={(f ? 'Edit ' : 'Add ') + s.name + '’s family'}>
                    {f ? 'Edit' : 'Add'}
                  </Btn>
                </span>
              </div>
            );
          })}
        </div>
        {!famQ && famList.length > shown.length ? <div className="text-[12px] text-neutral-500">Search for the other {famList.length - shown.length}.</div> : null}
      </section>

      <FamilySheet name={fam} onClose={() => setFam(null)} />
      <NewSlipSheet open={newSlip} onClose={() => setNewSlip(false)} defaultDay={iso >= isoDay(new Date()) ? iso : isoDay(new Date())} />
    </div>
  );
}
