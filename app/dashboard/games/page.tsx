import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { GamesScreen } from '@/components/screens/games';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.event);
  return (
    <Gate allow="event">
      <Suspense>
        <GamesScreen />
      </Suspense>
    </Gate>
  );
}
