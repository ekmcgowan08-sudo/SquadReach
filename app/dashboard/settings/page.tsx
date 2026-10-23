import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { SettingsScreen } from '@/components/screens/oversight';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.any);
  return (
    <Gate allow="any">
      <Suspense>
        <SettingsScreen />
      </Suspense>
    </Gate>
  );
}
