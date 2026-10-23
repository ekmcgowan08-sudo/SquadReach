import { Suspense } from 'react';
import { Liturgical } from '@/components/planner/liturgical';

export const metadata = { title: 'Liturgical year' };

export default function Page() {
  return (
    <Suspense>
      <Liturgical />
    </Suspense>
  );
}
