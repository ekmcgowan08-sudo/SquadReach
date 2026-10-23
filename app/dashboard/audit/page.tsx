import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { AuditScreen } from '@/components/screens/oversight';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.approve);
  return (
    <Gate allow="approve">
      <Suspense>
        <AuditScreen />
      </Suspense>
    </Gate>
  );
}
