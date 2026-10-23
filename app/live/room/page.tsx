import { Suspense } from 'react';
import { RoomPage } from '@/components/live/room-page';

export const metadata = { title: 'Room screen' };

export default function Page() {
  return (
    <Suspense>
      <RoomPage />
    </Suspense>
  );
}
