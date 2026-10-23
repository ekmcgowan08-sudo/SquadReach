import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { AwardsScreen } from '@/components/screens/awards';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.any);
  return (
    <Gate allow="any">
      <Suspense>
        <AwardsScreen />
      </Suspense>
    </Gate>
  );
}
