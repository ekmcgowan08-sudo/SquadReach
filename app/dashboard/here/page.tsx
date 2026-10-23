import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { HereScreen } from '@/components/screens/door';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.member);
  return (
    <Gate allow="member">
      <Suspense>
        <HereScreen />
      </Suspense>
    </Gate>
  );
}
