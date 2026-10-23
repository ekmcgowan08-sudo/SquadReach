import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { LibraryScreen } from '@/components/screens/library';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.library);
  return (
    <Gate allow="library">
      <Suspense>
        <LibraryScreen />
      </Suspense>
    </Gate>
  );
}
