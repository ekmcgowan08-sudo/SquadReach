import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { LiveScreen } from '@/components/screens/live';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.member);
  return (
    <Gate allow="member">
      <Suspense>
        <LiveScreen />
      </Suspense>
    </Gate>
  );
}
