import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { AutoRefresh, BoardView, DemoBoard } from '@/components/board/board-view';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/env';
import type { PublicBoardData } from '@/lib/public-board';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Live board', robots: { index: false, follow: false } };

/* /b/<parentCode> — the read-only board families open from a link. No login,
   no cookies: it calls public_board() as the anonymous role. */
export default async function PublicBoardPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = decodeURIComponent(code).slice(0, 32);
  if (!isSupabaseConfigured()) return <DemoBoard code={clean} />;
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.rpc('public_board', { p_code: clean });
  if (error || !data) notFound();
  return (
    <>
      <BoardView data={data as PublicBoardData} />
      <AutoRefresh />
    </>
  );
}
