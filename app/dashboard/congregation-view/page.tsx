import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { CongregationViewScreen } from '@/components/screens/role-views';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.congregationView);
  return (
    <Gate allow="congregationView">
      <Suspense>
        <CongregationViewScreen />
      </Suspense>
    </Gate>
  );
}
