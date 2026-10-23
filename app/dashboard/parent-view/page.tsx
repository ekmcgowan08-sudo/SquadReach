import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { ParentViewScreen } from '@/components/screens/role-views';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.parentView);
  return (
    <Gate allow="parentView">
      <Suspense>
        <ParentViewScreen />
      </Suspense>
    </Gate>
  );
}
