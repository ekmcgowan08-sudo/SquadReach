import { Suspense } from 'react';
import { HomeScreen } from '@/components/screens/home';
import { requireGate } from '@/lib/get-membership';

export default async function HomePage() {
  await requireGate();
  return (
    <Suspense>
      <HomeScreen />
    </Suspense>
  );
}
