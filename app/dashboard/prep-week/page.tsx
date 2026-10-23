import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { PrepWeekScreen } from '@/components/screens/prep-week';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.prep);
  return (
    <Gate allow="prep">
      <Suspense>
        <PrepWeekScreen />
      </Suspense>
    </Gate>
  );
}
