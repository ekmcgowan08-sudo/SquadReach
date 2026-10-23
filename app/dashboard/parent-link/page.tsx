import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { ParentLinkScreen } from '@/components/screens/night';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.board);
  return (
    <Gate allow="board">
      <Suspense>
        <ParentLinkScreen />
      </Suspense>
    </Gate>
  );
}
