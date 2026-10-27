import { redirect } from 'next/navigation';
import { AuthFrame } from '@/components/auth/auth-frame';
import { Onboarding } from '@/components/auth/onboarding';
import { nowMs } from '@/lib/dates';
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
  /* What you asked for, and what came of it lately: a request a leader
     turned down is shown here, not quietly dropped. */
  const { data } = await supabase
    .from('access_requests')
    .select('requested_role, created_at, status, decided_at, organizations(name)')
    .eq('user_id', user.id)
    .or('status.eq.pending,and(status.eq.denied,decided_at.gte.' + new Date(nowMs() - 30 * 86_400_000).toISOString() + ')')
    .order('created_at', { ascending: false });
  const rows = (data ?? []) as unknown as { requested_role: string; created_at: string; status: string; decided_at: string | null; organizations: { name: string } | null }[];
  const day = (t: string | null) => (t ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
  const view = (r: (typeof rows)[number]) => ({ ministry: r.organizations?.name ?? 'A ministry', role: r.requested_role, at: day(r.status === 'denied' ? r.decided_at : r.created_at) });
  const pending = rows.filter((r) => r.status === 'pending').map(view);
  const denied = rows.filter((r) => r.status === 'denied').map(view);
  return (
    <AuthFrame title="You’re signed in" sub="Join the ministry that invited you, or start your own.">
      <Onboarding code={code} email={user.email ?? ''} pending={pending} denied={denied} />
    </AuthFrame>
  );
}
