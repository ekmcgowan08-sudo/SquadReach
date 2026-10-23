import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { ReportViewScreen } from '@/components/screens/report-view';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.member);
  return (
    <Gate allow="member">
      <Suspense>
        <ReportViewScreen />
      </Suspense>
    </Gate>
  );
}
