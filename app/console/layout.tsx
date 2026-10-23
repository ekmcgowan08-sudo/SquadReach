import { ConsoleShell } from '@/components/console/console-shell';
import { GATES } from '@/lib/gates';
import { getCurrentMembership, requireGate } from '@/lib/get-membership';
import { AppProvider } from '@/lib/store/provider';

export const metadata = { title: 'Console' };

/* The desktop shape of the same ministry: setup, squads, scoring, people,
   the huddle sheet and reports. Leaders only — the database agrees. */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  await requireGate(GATES.approve);
  const res = (await getCurrentMembership())!;
  return (
    <AppProvider membership={res.membership} roles={res.roles}>
      <ConsoleShell>{children}</ConsoleShell>
    </AppProvider>
  );
}
