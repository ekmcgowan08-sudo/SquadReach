'use client';
/* The room screen, full window: open it on the projector's computer and it
   follows the leader's console. Click anywhere for full screen. */
import { useSearchParams } from 'next/navigation';
import { RoomScreen, Scaled } from '@/components/live/room-screen';
import { useLive } from '@/components/live/use-live';
import { joinUrl } from '@/components/screens/live';
import { Ready } from '@/components/shell/phone-shell';
import { tonightDate } from '@/lib/dates';
import { useApp } from '@/lib/store/provider';
import { useNow } from '@/lib/use-now';

export function RoomPage() {
  return (
    <div className="fixed inset-0 bg-black" onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}>
      <Ready>
        <Room />
      </Ready>
    </div>
  );
}

function Room() {
  const d = useApp((s) => s.data);
  const params = useSearchParams();
  const now = useNow(true, 500);
  const night = params.get('night') ?? (d.tonight.date || tonightDate(d.config.meetingDates, new Date(now)));
  const { room } = useLive(night);
  return (
    <Scaled fill>
      <RoomScreen room={room} joinUrl={joinUrl()} ministry={d.config.ministryName} now={now} />
    </Scaled>
  );
}
