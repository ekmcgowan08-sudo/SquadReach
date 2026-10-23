import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { SubmitPointsScreen } from '@/components/screens/night';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.submit);
  return (
    <Gate allow="submit">
      <Suspense>
        <SubmitPointsScreen />
      </Suspense>
    </Gate>
  );
}
