import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { RacesScreen } from '@/components/screens/races';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.member);
  return (
    <Gate allow="member">
      <Suspense>
        <RacesScreen />
      </Suspense>
    </Gate>
  );
}
