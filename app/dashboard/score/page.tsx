import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { ScoreScreen } from '@/components/screens/score';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.score);
  return (
    <Gate allow="score">
      <Suspense>
        <ScoreScreen />
      </Suspense>
    </Gate>
  );
}
