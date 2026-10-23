import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { WalkthroughStart } from '@/components/screens/walkthrough';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.any);
  return (
    <Gate allow="any">
      <Suspense>
        <WalkthroughStart />
      </Suspense>
    </Gate>
  );
}
