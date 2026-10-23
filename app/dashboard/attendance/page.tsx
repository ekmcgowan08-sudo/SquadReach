import { Suspense } from 'react';
import { Gate } from '@/components/gate';
import { AttendanceScreen } from '@/components/screens/night';
import { GATES } from '@/lib/gates';
import { requireGate } from '@/lib/get-membership';

export default async function Page() {
  await requireGate(GATES.attendance);
  return (
    <Gate allow="attendance">
      <Suspense>
        <AttendanceScreen />
      </Suspense>
    </Gate>
  );
}
