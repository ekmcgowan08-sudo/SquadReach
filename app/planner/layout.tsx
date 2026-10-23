import { PlannerShell } from '@/components/planner/kit';
import { GATES } from '@/lib/gates';
import { getCurrentMembership, requireGate } from '@/lib/get-membership';
import { AppProvider } from '@/lib/store/provider';

export const metadata = { title: 'Planner' };

/* The desk view of the ministry: tonight, the week around it, the people,
   and the seven-year plan. Leaders only — the database agrees. */
export default async function PlannerLayout({ children }: { children: React.ReactNode }) {
  await requireGate(GATES.approve);
  const res = (await getCurrentMembership())!;
  return (
    <AppProvider membership={res.membership} roles={res.roles}>
      <PlannerShell>{children}</PlannerShell>
    </AppProvider>
  );
}
