'use client';
/* Signed in, in no ministry yet: start one, or ask to join one. */
import { useActionState, useState } from 'react';
import { createMinistry, requestToJoin, type FormState } from '@/app/auth/actions';
import { Btn } from '@/components/ui';

const ROLES = [
  { id: 'member', label: 'Student' },
  { id: 'captain', label: 'Squad captain' },
  { id: 'coach', label: 'Coach / small group leader' },
  { id: 'scorekeeper', label: 'Scorekeeper' },
  { id: 'leader', label: 'Ministry leader / staff' }
];

type Asked = { ministry: string; role: string; at: string };

export function Onboarding({ code, email, pending, denied = [] }: { code?: string; email: string; pending: Asked[]; denied?: Asked[] }) {
  const [tab, setTab] = useState<'join' | 'create'>(code || pending.length ? 'join' : 'create');
  const [joinState, join, joining] = useActionState<FormState, FormData>(requestToJoin, {});
  const [createState, create, creating] = useActionState<FormState, FormData>(createMinistry, {});
  return (
    <div className="flex flex-col gap-4">
      {pending.length ? (
        <div className="flex flex-col gap-2 rounded-lg border border-accent-700 px-4 py-3" style={{ background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)' }}>
          <div className="text-[13px] font-medium leading-[1.3] text-accent-100">Waiting on a leader</div>
          {pending.map((p, i) => (
            <div key={i} className="text-[12px] leading-[1.5] text-neutral-300">
              {p.ministry} · as {ROLES.find((r) => r.id === p.role)?.label ?? p.role} · asked {p.at}
            </div>
          ))}
          <div className="text-[11.5px] leading-[1.5] text-neutral-500">Once someone approves you, reload this page and you’re in.</div>
        </div>
      ) : null}
      {denied.map((p, i) => (
        <div key={'d' + i} role="status" className="flex flex-col gap-1 rounded-lg border border-neutral-700 px-4 py-3">
          <div className="text-[13px] font-medium leading-[1.3] text-neutral-100">{p.ministry} said no to this request</div>
          <div className="text-[12px] leading-[1.5] text-neutral-400">
            You asked to join as {ROLES.find((r) => r.id === p.role)?.label ?? p.role}; a leader turned it down on {p.at}. If that’s a mistake, talk to someone who leads there — you can ask again with their invite code.
          </div>
        </div>
      ))}
      <div className="flex gap-1 self-start rounded-full border border-neutral-800 bg-neutral-900 p-[3px]">
        {(['join', 'create'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t} className="min-h-11 rounded-full px-[15px] text-[12.5px] font-medium leading-none" style={{ background: tab === t ? 'color-mix(in srgb, var(--color-accent) 22%, transparent)' : 'transparent', color: tab === t ? 'var(--color-accent-100)' : 'var(--color-neutral-400)' }}>
            {t === 'join' ? 'Join a ministry' : 'Start a ministry'}
          </button>
        ))}
      </div>
      {tab === 'join' ? (
        joinState.done ? (
          <div className="sr-card px-4 py-4 text-[13px] leading-[1.55] text-neutral-200">{joinState.done}</div>
        ) : (
          <form action={join} className="flex flex-col gap-3">
            <label className="field">
              <span className="sr-label">Invite code</span>
              <input name="code" className="input uppercase tracking-[.08em]" defaultValue={code ?? ''} placeholder="NSY-W9-4KQ" autoCapitalize="characters" required />
            </label>
            <label className="field">
              <span className="sr-label">Your name</span>
              <input name="name" className="input" autoComplete="name" placeholder="First and last" required />
            </label>
            <label className="field">
              <span className="sr-label">What you do</span>
              <select name="role" className="input" defaultValue="member">
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="sr-label">Anything a leader should know (optional)</span>
              <input name="note" className="input" placeholder="I’m Ellison’s mom — she’s in Yellow" />
            </label>
            {joinState.error ? <div className="text-[12px] leading-[1.5] text-danger">{joinState.error}</div> : null}
            <Btn type="submit" className="min-h-12 justify-center" disabled={joining}>
              {joining ? 'Sending…' : 'Ask to join'}
            </Btn>
            <div className="text-[11.5px] leading-[1.55] text-neutral-500 text-pretty">A leader approves every request. Until then you see nothing about the ministry’s students.</div>
          </form>
        )
      ) : (
        <form action={create} className="flex flex-col gap-3">
          <label className="field">
            <span className="sr-label">Ministry name</span>
            <input name="ministry" className="input" placeholder="Grace Community Students" required />
          </label>
          <label className="field">
            <span className="sr-label">Your name</span>
            <input name="name" className="input" autoComplete="name" placeholder="Pastor Mike Torres" required />
          </label>
          {createState.error ? <div className="text-[12px] leading-[1.5] text-danger">{createState.error}</div> : null}
          <Btn type="submit" className="min-h-12 justify-center" disabled={creating}>
            {creating ? 'Setting it up…' : 'Start the ministry'}
          </Btn>
          <div className="text-[11.5px] leading-[1.55] text-neutral-500 text-pretty">
            You’ll own it, with four squads and seven point categories to start — rename or replace them in the Console. Signed in as {email}.
          </div>
        </form>
      )}
    </div>
  );
}
