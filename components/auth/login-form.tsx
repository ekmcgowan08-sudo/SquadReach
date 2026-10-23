'use client';
import { useState } from 'react';
import { Btn } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/client';

export function LoginForm({ next, error }: { next: string; error?: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [err, setErr] = useState(error ?? '');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const addr = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(addr)) return setErr('That doesn’t look like an email address.');
    setErr('');
    setState('sending');
    const { error: e2 } = await supabaseBrowser().auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: window.location.origin + '/auth/callback?next=' + encodeURIComponent(next) }
    });
    if (e2) {
      setState('idle');
      setErr(e2.message);
      return;
    }
    setState('sent');
  };

  if (state === 'sent') {
    return (
      <div className="sr-card flex flex-col gap-2 px-[18px] py-4">
        <div className="text-[15px] font-medium leading-[1.3] text-neutral-100">Check {email.trim()}</div>
        <div className="text-[12.5px] leading-[1.55] text-neutral-400 text-pretty">The link signs you in on whichever device opens it. It works once and expires in an hour.</div>
        <button onClick={() => setState('idle')} className="mt-1 min-h-11 self-start text-[12.5px] font-medium text-accent-300">
          Use a different email
        </button>
      </div>
    );
  }
  return (
    <form onSubmit={send} className="flex flex-col gap-3">
      <label className="field">
        <span className="sr-label">Email</span>
        <input className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@church.org" required />
      </label>
      {err ? <div className="text-[12px] leading-[1.5] text-danger">{err}</div> : null}
      <Btn type="submit" className="min-h-12 justify-center" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
      </Btn>
      <div className="text-[11.5px] leading-[1.55] text-neutral-500 text-pretty">New here? Sign in first — then you can start a ministry or join one with the invite code your youth pastor shared.</div>
    </form>
  );
}
