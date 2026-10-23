import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { WalkthroughScreen } from '@/components/screens/walkthrough';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.approve);
  return (
    <Gate allow="approve">
      <Suspense>
        <WalkthroughScreen />
      </Suspense>
    </Gate>
  );
}
