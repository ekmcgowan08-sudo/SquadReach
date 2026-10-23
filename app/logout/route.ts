/* Sign out: end the Supabase session and forget which role was in use. */
import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured } from '@/lib/env';
import { ROLE_COOKIE } from '@/lib/get-membership';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  if (isSupabaseConfigured()) {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  }
  const res = NextResponse.redirect(new URL(isSupabaseConfigured() ? '/login' : '/dashboard', origin));
  res.cookies.delete(ROLE_COOKIE);
  return res;
}
