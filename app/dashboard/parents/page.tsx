import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { ParentsScreen } from '@/components/screens/parents';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.parents);
  return (
    <Gate allow="parents">
      <Suspense>
        <ParentsScreen />
      </Suspense>
    </Gate>
  );
}
