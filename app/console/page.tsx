import { Suspense } from 'react';
import { ConsoleScreen } from '@/components/console/console-screen';

export default function ConsolePage() {
  return (
    <Suspense>
      <ConsoleScreen />
    </Suspense>
  );
}
