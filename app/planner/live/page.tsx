import { Suspense } from 'react';
import { PlannerLive } from '@/components/planner/live';

export const metadata = { title: 'Live ministry time' };

export default function Page() {
  return (
    <Suspense>
      <PlannerLive />
    </Suspense>
  );
}
