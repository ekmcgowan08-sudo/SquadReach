import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { BibleScreen } from '@/components/screens/bible';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.any);
  return (
    <Gate allow="any">
      <Suspense>
        <BibleScreen />
      </Suspense>
    </Gate>
  );
}
