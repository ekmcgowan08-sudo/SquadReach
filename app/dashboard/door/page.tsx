import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { DoorKioskScreen } from '@/components/screens/door';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.door);
  return (
    <Gate allow="door">
      <Suspense>
        <DoorKioskScreen />
      </Suspense>
    </Gate>
  );
}
