import { Suspense } from 'react';
import { Roadmap } from '@/components/planner/roadmap';

export const metadata = { title: 'Roadmap' };

export default function Page() {
  return (
    <Suspense>
      <Roadmap />
    </Suspense>
  );
}
