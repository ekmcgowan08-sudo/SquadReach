import { Suspense } from 'react';
import { Coverage } from '@/components/planner/coverage';

export const metadata = { title: 'Coverage' };

export default function Page() {
  return (
    <Suspense>
      <Coverage />
    </Suspense>
  );
}
