import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthFrame } from '@/components/auth/auth-frame';
import { isSupabaseConfigured } from '@/lib/env';
import { getCurrentMembership, getUser } from '@/lib/get-membership';

export const metadata = { title: 'Join' };

/* An invite link: /join/NSY-W9-4KQ. Sign in first if needed, then the code
   is waiting in the join form. */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = decodeURIComponent(code).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
  if (!isSupabaseConfigured()) {
    return (
      <AuthFrame title="This is the demo" sub={'Invite links work once SquadRise is connected to your ministry’s database. The code ' + clean + ' would land a request in a leader’s queue.'}>
        <Link href="/dashboard" className="btn btn-primary min-h-12 justify-center">
          Open the demo
        </Link>
      </AuthFrame>
    );
  }
  if (!(await getUser())) redirect('/login?next=' + encodeURIComponent('/welcome?code=' + clean));
  if (await getCurrentMembership()) {
    return (
      <AuthFrame title="You’re already in a ministry" sub={'To add a role in another one, ask its leader — or use the code ' + clean + ' from Welcome after signing out.'}>
        <Link href="/dashboard" className="btn btn-primary min-h-12 justify-center">
          Back to the app
        </Link>
      </AuthFrame>
    );
  }
  redirect('/welcome?code=' + clean);
}
