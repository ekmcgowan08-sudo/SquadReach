import { redirect } from 'next/navigation';
import { AuthFrame } from '@/components/auth/auth-frame';
import { Onboarding } from '@/components/auth/onboarding';
import { isSupabaseConfigured } from '@/lib/env';
import { getCurrentMembership, getUser } from '@/lib/get-membership';
import { supabaseServer } from '@/lib/supabase/server';

export const metadata = { title: 'Welcome' };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  if (!isSupabaseConfigured()) redirect('/dashboard');
  const user = await getUser();
  if (!user) redirect('/login?next=/welcome');
  if (await getCurrentMembership()) redirect('/dashboard');
  const { code } = await searchParams;
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('access_requests')
    .select('requested_role, created_at, status, organizations(name)')
    .eq('user_id', user.id)
    .eq('status', 'pending');
  const pending = ((data ?? []) as unknown as { requested_role: string; created_at: string; organizations: { name: string } | null }[]).map((r) => ({
    ministry: r.organizations?.name ?? 'A ministry',
    role: r.requested_role,
    at: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));
  return (
    <AuthFrame title="You’re signed in" sub="Join the ministry that invited you, or start your own.">
      <Onboarding code={code} email={user.email ?? ''} pending={pending} />
    </AuthFrame>
  );
}
