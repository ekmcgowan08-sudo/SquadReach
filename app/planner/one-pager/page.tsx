import { Suspense } from 'react';
import { OnePager } from '@/components/planner/one-pager';

export const metadata = { title: 'One-pager' };

export default function Page() {
  return (
    <Suspense>
      <OnePager />
    </Suspense>
  );
}
