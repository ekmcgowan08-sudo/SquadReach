import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { ServingScreen } from '@/components/screens/serving';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.serve);
  return (
    <Gate allow="serve">
      <Suspense>
        <ServingScreen />
      </Suspense>
    </Gate>
  );
}
