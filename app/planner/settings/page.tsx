import { Suspense } from 'react';
import { PlannerSettings } from '@/components/planner/settings';

export const metadata = { title: 'Planner settings' };

export default function Page() {
  return (
    <Suspense>
      <PlannerSettings />
    </Suspense>
  );
}
