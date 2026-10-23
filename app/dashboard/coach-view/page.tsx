import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { CoachViewScreen } from '@/components/screens/coach-view';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.coachView);
  return (
    <Gate allow="coachView">
      <Suspense>
        <CoachViewScreen />
      </Suspense>
    </Gate>
  );
}
