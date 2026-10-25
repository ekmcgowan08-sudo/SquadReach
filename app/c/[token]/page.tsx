import { createClient } from '@supabase/supabase-js';
import { CastGone, CastScreen, type CastRaw } from '@/components/live/cast-screen';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Room screen', robots: { index: false, follow: false } };

/* /c/<token> — the room screen on a TV or cast device. No login, no
   cookies: live_cast_room() runs as the anonymous role and returns the
   room snapshot for a cast link that hasn't been stopped or run out. */
export default async function CastPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clean = decodeURIComponent(token).slice(0, 80);
  if (!isSupabaseConfigured()) return <CastGone demo />;
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.rpc('live_cast_room', { p_token: clean });
  if (error || !data) return <CastGone />;
  return <CastScreen token={clean} initial={data as CastRaw} />;
}
