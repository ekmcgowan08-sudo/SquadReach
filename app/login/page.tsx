import { redirect } from 'next/navigation';
import { AuthFrame } from '@/components/auth/auth-frame';
import { LoginForm } from '@/components/auth/login-form';
import { isSupabaseConfigured } from '@/lib/env';
import { getUser } from '@/lib/get-membership';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  /* No backend configured: the app is the demo, and nobody signs in. */
  if (!isSupabaseConfigured()) redirect('/dashboard');
  if (await getUser()) redirect('/dashboard');
  const { next, error } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  return (
    <AuthFrame title="Sign in to your ministry" sub="We email you a link — no password to remember. Open it on this phone and you’re in.">
      <LoginForm next={safeNext} error={error === 'link' ? 'That sign-in link expired or was already used. Send a new one.' : undefined} />
    </AuthFrame>
  );
}
