import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { AdminViewScreen } from '@/components/screens/role-views';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.adminView);
  return (
    <Gate allow="adminView">
      <Suspense>
        <AdminViewScreen />
      </Suspense>
    </Gate>
  );
}
