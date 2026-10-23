import { GATES } from '@/lib/gates';
import { getCurrentMembership, requireGate } from '@/lib/get-membership';
import { AppProvider } from '@/lib/store/provider';

export const metadata = { title: 'Live' };

/* The room screen for ministry time, on the computer that drives the
   projector (EVENT_CONTROL_ROLES, like the projector itself). */
export default async function LiveLayout({ children }: { children: React.ReactNode }) {
  await requireGate(GATES.event);
  const res = (await getCurrentMembership())!;
  return (
    <AppProvider membership={res.membership} roles={res.roles}>
      {children}
    </AppProvider>
  );
}
