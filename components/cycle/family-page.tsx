'use client';
/* The page a family opens from their private link. No sign-in: the token in
   the link is the key, and it opens one student's card and nothing else. */
import { createClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { FamilyTonightCard } from '@/components/cycle/family-card';
import { familyView, type FamilyView } from '@/lib/cycle';
import { useNow } from '@/lib/use-now';
import { SNAPSHOT_KEY } from '@/lib/data/demo-backend';
import { demoMinistry } from '@/lib/data/seed';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';
import { familyFromRaw, type FamilyRaw } from '@/lib/family';
import type { MinistryData } from '@/lib/types/model';

function Frame({ v, children }: { v: FamilyView | null; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh justify-center bg-bg px-4">
      <div className="flex w-full max-w-[440px] flex-col gap-4 py-8">
        <div className="text-[15px] font-bold leading-none tracking-[-.01em] text-neutral-300">
          SQUAD<span className="text-accent-400">RISE</span>
        </div>
        {v ? (
          <div>
            <div className="text-[11px] uppercase tracking-[.12em] text-neutral-500">{v.ministry}</div>
            <h1 className="mt-1 text-[24px] font-medium leading-[1.15] text-neutral-100">{v.first}’s family page</h1>
          </div>
        ) : null}
        {children}
        <p className="text-[11px] leading-[1.5] text-neutral-500 text-pretty">This link is just for your family. If someone else has it, ask the leaders for a new one — the old link stops working.</p>
      </div>
    </main>
  );
}

const Gone = () => (
  <Frame v={null}>
    <div className="rounded-md border border-dashed border-neutral-700 px-4 py-6 text-center text-[13px] text-neutral-400">This family link was replaced or never existed. Ask your ministry for the current one.</div>
  </Frame>
);

export function DemoFamily({ token }: { token: string }) {
  const [state, setState] = useState<{ d: MinistryData; kid: string } | null | 'missing'>(null);
  const now = useNow(true, 30_000);
  const read = useCallback(() => {
    let d = demoMinistry();
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (raw) {
        const p = JSON.parse(raw) as MinistryData;
        d = { ...d, ...p, config: { ...d.config, ...p.config } };
      }
    } catch {
      /* the seed it is */
    }
    const kid = Object.entries(d.families ?? {}).find(([, f]) => f.token === token)?.[0];
    setState(kid ? { d, kid } : 'missing');
  }, [token]);
  useEffect(() => {
    const first = window.setTimeout(read, 0);
    const id = window.setInterval(read, 5000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [read]);
  const write = (fn: (d: MinistryData) => void) => {
    if (!state || state === 'missing') return;
    fn(state.d);
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(state.d));
    } catch {
      /* storage blocked: the change lasts for this view */
    }
    setState({ ...state });
  };
  if (state === null) return null;
  if (state === 'missing') return <Gone />;
  const v = familyView(state.d, state.kid, now);
  if (!v) return <Gone />;
  return (
    <Frame v={v}>
      <FamilyTonightCard
        v={v}
        onSign={(slip) => write((d) => void (d.slipSigned[slip + '|' + state.kid] = { by: v.guardian || 'Family', at: Date.now() }))}
        onRead={(id) => write((d) => void d.parentMsgs.forEach((m) => m.id === id && (m.reads[state.kid] = Date.now())))}
      />
    </Frame>
  );
}

export function LiveFamily({ token, initial }: { token: string; initial: FamilyRaw }) {
  const [raw, setRaw] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const db = useCallback(() => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } }), []);
  const refresh = useCallback(async () => {
    const { data } = await db().rpc('family_view', { p_token: token });
    if (data) setRaw(data as FamilyRaw);
    setNow(Date.now());
  }, [db, token]);
  useEffect(() => {
    const id = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(id);
  }, [refresh]);
  const v = familyFromRaw(raw, now);
  if (!v) return <Gone />;
  return (
    <Frame v={v}>
      <FamilyTonightCard
        v={v}
        onSign={async (slip) => {
          await db().rpc('family_sign', { p_token: token, p_slip: slip });
          await refresh();
        }}
        onRead={async (id) => {
          await db().rpc('family_read', { p_token: token, p_msg: id });
          await refresh();
        }}
      />
    </Frame>
  );
}

export { Gone as FamilyGone };
