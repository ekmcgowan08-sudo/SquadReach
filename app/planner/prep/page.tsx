import { Suspense } from 'react';
import { PrepRecap } from '@/components/planner/prep';

export const metadata = { title: 'Prep & recap' };

export default function Page() {
  return (
    <Suspense>
      <PrepRecap />
    </Suspense>
  );
}
