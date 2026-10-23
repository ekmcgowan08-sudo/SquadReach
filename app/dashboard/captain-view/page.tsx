import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { CaptainViewScreen } from '@/components/screens/role-views';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.captainView);
  return (
    <Gate allow="captainView">
      <Suspense>
        <CaptainViewScreen />
      </Suspense>
    </Gate>
  );
}
