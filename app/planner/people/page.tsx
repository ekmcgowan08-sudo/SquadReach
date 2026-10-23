import { Suspense } from 'react';
import { PeopleDesk } from '@/components/planner/people';

export const metadata = { title: 'People' };

export default function Page() {
  return (
    <Suspense>
      <PeopleDesk />
    </Suspense>
  );
}
