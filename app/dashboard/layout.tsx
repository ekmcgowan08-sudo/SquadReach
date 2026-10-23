import { redirect } from 'next/navigation';
import { PhoneShell } from '@/components/shell/phone-shell';
import { isSupabaseConfigured } from '@/lib/env';
import { getCurrentMembership } from '@/lib/get-membership';
import { AppProvider } from '@/lib/store/provider';

/* Every dashboard route loads through getCurrentMembership(). Pages add their
   own role gate with requireGate(); the screens re-check on the client. */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const res = await getCurrentMembership();
  if (!res) redirect(isSupabaseConfigured() ? '/login' : '/');
  return (
    <AppProvider membership={res.membership} roles={res.roles}>
      <PhoneShell>{children}</PhoneShell>
    </AppProvider>
  );
}
