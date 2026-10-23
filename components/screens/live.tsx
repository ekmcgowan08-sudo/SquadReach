'use client';
/* LIVE — ministry time on the phone. A leader gets the console (the room
   screen mirrors from here, or opens on the projector); everyone else gets
   the answer pad. Scanning the room's code lands here with ?in=1. */
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { LiveConsole, LiveResultsList } from '@/components/live/console';
import { RoomScreen, Scaled } from '@/components/live/room-screen';
import { StudentLive } from '@/components/live/student';
import { useLiveConsole } from '@/components/live/use-live';
import { useCycle } from '@/components/cycle/use-cycle';
import { Screen, ScreenHeader, cx } from '@/components/ui';
import { canRunLive } from '@/lib/permissions';
import { longDate as dayLabel } from '@/lib/dates';

export function LiveScreen() {
  const { m, iso, d } = useCycle();
  const params = useSearchParams();
  const night = params.get('night') ?? iso;
  return (
    <Screen label="Live">
      <ScreenHeader title="Live" sub={d.config.ministryName + ' · ' + dayLabel(night)} back="/dashboard/more" />
      {canRunLive(m.persona) ? <LeaderLive night={night} /> : <StudentLive night={night} scanned={params.get('in') === '1'} />}
    </Screen>
  );
}

function LeaderLive({ night }: { night: string }) {
  const c = useLiveConsole(night);
  const [tab, setTab] = useState<'run' | 'room' | 'results'>('run');
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-full border border-neutral-800 p-1" role="tablist">
        {(
          [
            ['run', 'Run'],
            ['room', 'Room screen'],
            ['results', 'Results']
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cx('min-h-9 flex-1 rounded-full text-[12.5px] font-medium', tab === id ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400')}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'run' ? <LiveConsole c={c} roomHref={'/live/room?night=' + night} /> : null}
      {tab === 'room' ? (
        <div className="flex flex-col gap-2">
          <div className="overflow-hidden rounded-lg border border-neutral-800">
            <Scaled>
              <RoomScreen room={c.ready ? c.room : null} joinUrl={joinUrl()} ministry={c.d.config.ministryName} now={c.now} />
            </Scaled>
          </div>
          <div className="text-[12px] leading-[1.5] text-neutral-500">Mirror this phone to the projector, or open the room screen on the computer that drives it.</div>
        </div>
      ) : null}
      {tab === 'results' ? (
        <div className="sr-card px-4 py-4">
          <LiveResultsList c={c} />
        </div>
      ) : null}
    </div>
  );
}

export const joinUrl = () => (typeof window === 'undefined' ? '' : window.location.origin) + '/dashboard/live?in=1';
