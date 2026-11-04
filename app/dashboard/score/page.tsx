import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { ScoreScreen } from '@/components/screens/score';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';
import { ScoredOnly } from '@/components/screens/scored-only';

export default async function Page() {
  await requireGate(GATES.score);
  return (
    <Gate allow="score">
      <Suspense>
        <ScoredOnly title="Score">
          <ScoreScreen />
        </ScoredOnly>
      </Suspense>
    </Gate>
  );
}
