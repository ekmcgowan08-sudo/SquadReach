import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { MediaScreen } from '@/components/screens/media';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.any);
  return (
    <Gate allow="any">
      <Suspense>
        <MediaScreen />
      </Suspense>
    </Gate>
  );
}
