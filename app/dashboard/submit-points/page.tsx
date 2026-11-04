import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { SubmitPointsScreen } from '@/components/screens/night';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';
import { ScoredOnly } from '@/components/screens/scored-only';

export default async function Page() {
  await requireGate(GATES.submit);
  return (
    <Gate allow="submit">
      <Suspense>
        <ScoredOnly title="Submit points">
          <SubmitPointsScreen />
        </ScoredOnly>
      </Suspense>
    </Gate>
  );
}
