import { createClient } from '@supabase/supabase-js';
import { DemoFamily, FamilyGone, LiveFamily } from '@/components/cycle/family-page';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/env';
import type { FamilyRaw } from '@/lib/family';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Family page', robots: { index: false, follow: false } };

/* /f/<token> — one family's page. No login, no cookies: family_view() runs
   as the anonymous role and returns one student's rows for a valid token. */
export default async function FamilyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clean = decodeURIComponent(token).slice(0, 64);
  if (!isSupabaseConfigured()) return <DemoFamily token={clean} />;
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.rpc('family_view', { p_token: clean });
  if (error || !data) return <FamilyGone />;
  return <LiveFamily token={clean} initial={data as FamilyRaw} />;
}
