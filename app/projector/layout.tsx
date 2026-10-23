import { GATES } from '@/lib/gates';
import { getCurrentMembership, requireGate } from '@/lib/get-membership';
import { AppProvider } from '@/lib/store/provider';

export const metadata = { title: 'Projector' };

/* The TV in the gym: signed in as whoever runs the night (EVENT_CONTROL_ROLES). */
export default async function ProjectorLayout({ children }: { children: React.ReactNode }) {
  await requireGate(GATES.event);
  const res = (await getCurrentMembership())!;
  return (
    <AppProvider membership={res.membership} roles={res.roles}>
      {children}
    </AppProvider>
  );
}
