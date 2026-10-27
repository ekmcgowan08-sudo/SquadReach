'use client';
/* CONSOLE · PEOPLE · ACCESS REQUESTS — everyone who used the invite code
   and is waiting, with what's on file. A requested role never becomes
   active on its own: approve it, approve them as the role that actually
   fits what they do, or deny it. */
import { useState } from 'react';
import { Section } from '@/components/console/kit';
import { grantableRoles, useDecideAccess } from '@/components/screens/role-views';
import { Btn, Icon, initialsOf } from '@/components/ui';
import { useApp } from '@/lib/store/provider';
import { personaDef, type Persona } from '@/lib/types/domain';
import type { AccessRequest } from '@/lib/types/model';

const ENFORCES = [
  'Every account belongs to this ministry. Nobody from another church can reach your people.',
  'A requested role stays inert until a leader approves it. There is no self-service permission.',
  'Only an owner can make someone an owner.',
  'A parent sees only their own student, through their family’s private link.',
  'Every approval and denial is written to the audit log with your name and the time.'
];

function RequestCard({ q }: { q: AccessRequest }) {
  const c = useApp((s) => s.data.config);
  const me = useApp((s) => s.membership.persona);
  const decide = useDecideAccess();
  const roles = grantableRoles(q, me).filter((r) => r !== q.requestedRole);
  const [as, setAs] = useState<Persona>(roles[0] ?? q.requestedRole);
  const rows: [string, string][] = [
    ['Ministry', c.ministryName],
    ['Requested', personaDef(q.requestedRole).label],
    ['On file', q.meta || '—'],
    ['Submitted', new Date(q.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })],
    ['Household', q.household || '—'],
    ['Their note', q.note || '—']
  ];
  return (
    <div role="group" aria-label={'Request from ' + q.name} className="flex flex-col gap-3 rounded-md border border-neutral-800 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-neutral-800 text-[13px] font-semibold text-neutral-200">{initialsOf(q.name)}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium text-neutral-100">{q.name}</div>
          <div className="text-[12px] text-neutral-400">
            {q.personType}
            {q.email ? ' · ' + q.email : ''}
          </div>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[.1em] text-neutral-400">Pending</span>
      </div>
      <dl className="grid gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-3">
            <dt className="w-[90px] flex-none text-neutral-500">{k}</dt>
            <dd className="min-w-0 text-neutral-200">{v}</dd>
          </div>
        ))}
      </dl>
      {q.flagged ? (
        <div className="flex items-start gap-2 rounded-md bg-neutral-900 px-3 py-2 text-[12.5px] text-neutral-200">
          <Icon name="ph ph-info" className="mt-[2px] text-[14px] text-accent-300" />
          Parent link unconfirmed — no household record ties this person to a student. Verify the relationship yourself before approving.
        </div>
      ) : null}
      <div className="flex flex-wrap items-end gap-2 border-t border-divider pt-3">
        <Btn variant="secondary" className="px-4" onClick={() => decide(q, true)}>
          Approve as requested
        </Btn>
        {roles.length ? (
          <>
            <label className="field">
              <span className="sr-label">Or assign</span>
              <select className="input" value={as} onChange={(e) => setAs(e.target.value as Persona)} aria-label={'Or assign ' + q.name + ' as'}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {personaDef(r).label}
                  </option>
                ))}
              </select>
            </label>
            <Btn variant="secondary" className="px-4" onClick={() => decide(q, true, as)} ariaLabel={'Change & approve ' + q.name + ' as ' + personaDef(as).label}>
              Change &amp; approve
            </Btn>
          </>
        ) : null}
        <Btn variant="ghost" className="ml-auto px-3" onClick={() => decide(q, false)} ariaLabel={'Deny ' + q.name}>
          Deny
        </Btn>
      </div>
    </div>
  );
}

export function AccessSection() {
  const d = useApp((s) => s.data);
  const pending = d.accessRequests.filter((r) => r.status === 'pending');
  const decided = d.accessRequests.filter((r) => r.status !== 'pending').slice(-6).reverse();
  return (
    <div id="access-requests" className="contents">
      <Section
        title="Access requests"
        sub={'Anyone with the invite code (' + (d.config.inviteCode || '—') + ') can ask to join. Nobody gets in, and nobody sees a student’s name, until a leader decides here or on the phone.'}
        right={<span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[.1em] text-neutral-400">{pending.length ? pending.length + ' pending' : 'none pending'}</span>}
      >
        {pending.map((q) => (
          <RequestCard key={q.id} q={q} />
        ))}
        {!pending.length ? <p className="text-[13px] text-neutral-500">Nothing pending right now.</p> : null}
        {decided.length ? (
          <div className="flex flex-col">
            <span className="sr-label">Decided</span>
            {decided.map((r) => (
              <div key={r.id} className="flex items-center gap-3 border-t border-divider py-2 text-[13px] first:border-t-0">
                <span className="flex-1 text-neutral-200">{r.name}</span>
                <span className="text-neutral-400">{personaDef(r.grantedRole ?? r.requestedRole).label}{r.grantedRole ? ' (asked for ' + personaDef(r.requestedRole).label + ')' : ''}</span>
                <span className={r.status === 'approved' ? 'text-accent-300' : 'text-neutral-400'}>{r.status === 'approved' ? 'Approved' : 'Denied'}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex flex-col gap-1 border-t border-divider pt-3">
          <span className="text-[13px] font-medium text-neutral-100">What this enforces</span>
          {ENFORCES.map((x) => (
            <span key={x} className="flex items-start gap-2 text-[12.5px] text-neutral-400">
              <Icon name="ph ph-shield-check" className="mt-[2px] text-[14px] text-neutral-500" />
              {x}
            </span>
          ))}
        </div>
      </Section>
    </div>
  );
}
