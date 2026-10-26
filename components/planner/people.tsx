'use client';
/* PLANNER · PEOPLE — volunteers and parents from a desk. Who serves when
   as a table, everyone's availability as a grid, swaps to decide, and on
   the Parents side, what a family actually sees. */
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { FamilyTonightCard } from '@/components/cycle/family-card';
import { useCycle } from '@/components/cycle/use-cycle';
import { PageHead, Panel } from '@/components/planner/kit';
import { ParentsScreen } from '@/components/screens/parents';
import { Btn, Switch2 } from '@/components/ui';
import { atLocal, availOf, dayLabel, familyView, servePool, whoServes } from '@/lib/cycle';
import { useAppApi } from '@/lib/store/provider';
import type { SwapRequest } from '@/lib/types/model';

const nightLabel = (iso: string) => dayLabel(atLocal(iso, '12:00'));

export function PeopleDesk() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get('tab') === 'parents' ? 'parents' : 'volunteers';
  return (
    <>
      <PageHead
        kicker="People"
        title={tab === 'parents' ? 'Parents' : 'Volunteers'}
        sub={tab === 'parents' ? 'Messages, slips, pickup and each family’s private link.' : 'Volunteers ask for swaps from the app; you approve them here. Changes show on the phones within a second.'}
        right={
          <div className="w-[280px]">
            <Switch2 label="Show" value={tab} options={[{ id: 'volunteers', label: 'Volunteers' }, { id: 'parents', label: 'Parents' }]} onChange={(v) => router.replace('/planner/people' + (v === 'parents' ? '?tab=parents' : ''))} />
          </div>
        }
      />
      {tab === 'parents' ? <Parents /> : <Volunteers />}
    </>
  );
}

function Volunteers() {
  const { d, m, nights } = useCycle();
  const api = useAppApi();
  const pool = servePool(d);
  const roles = d.config.cycle.serveRoles;
  const pend = d.serving.swaps.filter((s) => s.status === 'pending');
  const [pick, setPick] = useState<Record<string, string>>({});
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
    api().logActivity((ok ? 'Approved swap: ' + to + ' takes ' : 'Declined swap: ') + w.role.toLowerCase() + ' on ' + nightLabel(w.night));
  };
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[1.5fr_1fr]">
      <div className="flex flex-col gap-5">
        <Panel title="Who serves when" meta={'next ' + nights.length + ' nights'}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-[12.5px]">
              <thead>
                <tr>
                  <th className="py-2 pr-3 font-medium text-neutral-500">Role</th>
                  {nights.map((n) => (
                    <th key={n} className="py-2 pr-3 font-medium text-neutral-400">
                      {nightLabel(n)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r} className="border-t border-divider">
                    <td className="py-2 pr-3 text-neutral-400">{r}</td>
                    {nights.map((n) => {
                      const who = whoServes(d, n, r);
                      const away = who && availOf(d, who, n) === 'no';
                      return (
                        <td key={n} className="py-[6px] pr-3">
                          <select
                            className="input !min-h-9 !py-0"
                            value={who ?? ''}
                            onChange={(e) => setWho(n, r, e.target.value || null)}
                            aria-label={r + ' on ' + nightLabel(n)}
                            style={{ color: who ? (away ? 'var(--color-accent-200)' : 'var(--color-neutral-100)') : 'var(--color-accent-300)' }}
                          >
                            <option value="">Leave open</option>
                            {pool.map((p) => (
                              <option key={p} value={p}>
                                {p}
                                {availOf(d, p, n) === 'no' ? ' (away)' : availOf(d, p, n) === 'yes' ? ' (in)' : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Availability" meta="click to cycle: in, away, not said">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[12px]">
              <thead>
                <tr>
                  <th className="py-2 pr-3 text-left font-medium text-neutral-500">Volunteer</th>
                  {nights.map((n) => (
                    <th key={n} className="py-2 font-medium text-neutral-400">
                      {nightLabel(n).replace(/^\w+, /, '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pool.map((p) => (
                  <tr key={p} className="border-t border-divider">
                    <td className="py-[5px] pr-3 text-neutral-200">{p}</td>
                    {nights.map((n) => {
                      const a = availOf(d, p, n);
                      return (
                        <td key={n} className="py-[5px] text-center">
                          <button
                            onClick={() => cycle(p, n)}
                            aria-label={p + ' on ' + nightLabel(n) + ': ' + (a === 'yes' ? 'in' : a === 'no' ? 'away' : 'not said')}
                            className="min-h-8 min-w-[70px] rounded-full border px-2 text-[11px]"
                            style={{ borderColor: a === 'yes' ? 'var(--color-accent-600)' : 'var(--color-neutral-800)', color: a === 'yes' ? 'var(--color-accent-200)' : a === 'no' ? 'var(--color-neutral-300)' : 'var(--color-neutral-500)' }}
                          >
                            {a === 'yes' ? 'In' : a === 'no' ? 'Away' : '—'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <div className="flex flex-col gap-5">
        <Panel title="Swap requests" meta={pend.length ? pend.length + ' waiting' : ''}>
          {!pend.length ? <div className="text-[12.5px] text-neutral-500">Nothing waiting. Requests from the phone land here.</div> : null}
          {pend.map((w) => {
            const chosen = pick[w.id] ?? w.to;
            return (
              <div key={w.id} className="flex flex-col gap-2 rounded-md border border-neutral-800 p-3">
                <div className="text-[13px] font-medium text-neutral-100">
                  {w.from} can’t do {w.role.toLowerCase()}
                </div>
                <div className="text-[11.5px] text-neutral-500">
                  {nightLabel(w.night)} · {w.why || 'No reason given'}
                </div>
                <select className="input !min-h-9 !py-0" value={chosen ?? ''} onChange={(e) => setPick((x) => ({ ...x, [w.id]: e.target.value }))} aria-label="Who takes it">
                  <option value="">Pick who takes it…</option>
                  {pool
                    .filter((n) => n !== w.from)
                    .map((n) => (
                      <option key={n} value={n}>
                        {n}
                        {availOf(d, n, w.night) === 'yes' ? ' (in)' : availOf(d, n, w.night) === 'no' ? ' (away)' : ''}
                      </option>
                    ))}
                </select>
                <div className="flex gap-2">
                  <Btn className="flex-1 justify-center text-[12px]" disabled={!chosen} onClick={() => decide(w, true)}>
                    Approve
                  </Btn>
                  <Btn variant="ghost" className="flex-1 justify-center text-[12px]" onClick={() => decide(w, false)}>
                    Decline
                  </Btn>
                </div>
              </div>
            );
          })}
        </Panel>
        <Panel title="Invites">
          {d.serving.invites.map((v) => (
            <div key={v.id} className="flex items-center gap-2 border-t border-divider pt-2 first:border-t-0 first:pt-0">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-neutral-100">{v.name}</div>
                <div className="truncate text-[11px] text-neutral-500">
                  {v.role} · {v.contact || 'no contact'} · {new Date(v.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
              <span className="text-[11px]" style={{ color: v.status === 'accepted' ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }}>
                {v.status === 'accepted' ? 'On the team' : 'Sent'}
              </span>
            </div>
          ))}
          <Btn variant="secondary" className="self-start px-3 text-[12px]" href="/dashboard/serving">
            Invite from the phone screen
          </Btn>
        </Panel>
      </div>
    </div>
  );
}

function Parents() {
  const { d, now } = useCycle();
  const kids = d.roster.filter((s) => d.families[s.name]);
  const [kid, setKid] = useState(kids[0]?.name ?? '');
  const v = kid ? familyView(d, kid, now) : null;
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1.2fr_1fr]">
      <div className="sr-card overflow-hidden pt-2">
        <ParentsScreen bare />
      </div>
      <Panel title="What parents see" meta="their own child only">
        <div className="text-[12px] leading-[1.5] text-neutral-400 text-pretty">Tonight’s plan and pickup, their child’s slips and attendance, and your messages. Prayer requests, notes and other children stay out of it.</div>
        <select className="input" value={kid} onChange={(e) => setKid(e.target.value)} aria-label="Preview a family">
          {kids.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name} — {d.families[s.name].guardian || 'no guardian named'}
            </option>
          ))}
        </select>
        {v ? <FamilyTonightCard v={v} onSign={() => undefined} onRead={() => undefined} /> : <div className="text-[12px] text-neutral-500">No families on file yet.</div>}
        <div className="text-[11px] text-neutral-500">A preview — signing here does nothing. Families use their own link.</div>
      </Panel>
    </div>
  );
}
