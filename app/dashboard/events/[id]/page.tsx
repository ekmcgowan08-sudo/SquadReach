import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { EventDetailScreen } from '@/components/screens/calendar';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireGate(GATES.any);
  const { id } = await params;
  return (
    <Gate allow="any">
      <Suspense>
        <EventDetailScreen id={id} />
      </Suspense>
    </Gate>
  );
}
