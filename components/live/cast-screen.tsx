'use client';
/* A cast screen: the room screen on a screen signed in as nobody — a TV's
   browser, a cast device, the projector's own computer. It reads the room
   through its cast link about once a second and goes dark when the link
   is stopped or runs out. */
import { createClient } from '@supabase/supabase-js';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { RoomScreen, Scaled } from '@/components/live/room-screen';
import { Icon } from '@/components/ui';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';
import type { LiveRoom } from '@/lib/live';
import { useNow } from '@/lib/use-now';

export interface CastRaw {
  night: string;
  ministry: string;
  room: LiveRoom | null;
}

const noop = () => () => {};

export function CastScreen({ token, initial }: { token: string; initial: CastRaw }) {
  const [raw, setRaw] = useState<CastRaw | null>(initial);
  const now = useNow(true, 500);
  const join = useSyncExternalStore(noop, () => location.origin + '/dashboard/live?in=1', () => '');
  useEffect(() => {
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    let done = false;
    let t = 0;
    const tick = async () => {
      const { data, error } = await db.rpc('live_cast_room', { p_token: token });
      if (done) return;
      /* A dropped request keeps the last picture; only the link's own
         answer — nothing there — ends the cast. */
      if (!error) setRaw((data as CastRaw | null) ?? null);
      if (error || data) t = window.setTimeout(tick, 1000);
    };
    t = window.setTimeout(tick, 1000);
    return () => {
      done = true;
      window.clearTimeout(t);
    };
  }, [token]);
  if (!raw) return <CastGone />;
  return (
    <div className="fixed inset-0 bg-black" onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}>
      <Scaled fill>
        <RoomScreen room={raw.room?.night ? raw.room : null} joinUrl={join} ministry={raw.ministry} now={now} />
      </Scaled>
    </div>
  );
}

export function CastGone({ demo }: { demo?: boolean }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-black px-8 text-center">
      <Icon name="ph ph-screencast" className="text-[40px] text-neutral-600" />
      <div className="text-[22px] font-medium text-neutral-100">{demo ? 'Casting needs the live app' : 'This cast has ended'}</div>
      <p className="max-w-[440px] text-[14px] leading-[1.55] text-neutral-400">
        {demo ? 'In the demo, the room lives on one device: open the room screen in another window of the same browser instead.' : 'Cast links last one evening. Start casting again from the console on the leader’s phone.'}
      </p>
    </div>
  );
}
