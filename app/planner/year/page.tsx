import { Suspense } from 'react';
import { YearBoard } from '@/components/planner/year';

export const metadata = { title: 'Ministry year' };

export default function Page() {
  return (
    <Suspense>
      <YearBoard />
    </Suspense>
  );
}
