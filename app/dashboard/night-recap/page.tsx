import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { NightRecapScreen } from '@/components/screens/night-recap';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.nightRecap);
  return (
    <Gate allow="nightRecap">
      <Suspense>
        <NightRecapScreen />
      </Suspense>
    </Gate>
  );
}
