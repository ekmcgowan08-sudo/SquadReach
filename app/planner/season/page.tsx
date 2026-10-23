import { Suspense } from 'react';
import { SeasonNight } from '@/components/planner/season';

export const metadata = { title: 'Season & night' };

export default function Page() {
  return (
    <Suspense>
      <SeasonNight />
    </Suspense>
  );
}
