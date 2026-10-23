import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { HuddleScreen } from '@/components/screens/huddle';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.huddle);
  return (
    <Gate allow="huddle">
      <Suspense>
        <HuddleScreen />
      </Suspense>
    </Gate>
  );
}
