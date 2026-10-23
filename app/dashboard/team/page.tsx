import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { TeamViewScreen } from '@/components/screens/role-views';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.teamView);
  return (
    <Gate allow="teamView">
      <Suspense>
        <TeamViewScreen />
      </Suspense>
    </Gate>
  );
}
