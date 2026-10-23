import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { RecapScreen } from '@/components/screens/recap';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.recap);
  return (
    <Gate allow="recap">
      <Suspense>
        <RecapScreen />
      </Suspense>
    </Gate>
  );
}
