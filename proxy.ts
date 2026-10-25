/* Keeps a Supabase session fresh on every request: reads the auth cookies,
   lets @supabase/ssr refresh an expiring token, and writes the new cookies
   onto both the forwarded request and the response. It decides nothing about
   access — pages do that with requireGate, and the database with RLS. */
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      }
    }
  });
  /* getUser() validates the token with Supabase and triggers the refresh. */
  await supabase.auth.getUser();
  return response;
}

export const config = {
  /* Everything but static files, the service worker and the pages opened
     without signing in: the public board, family links and cast screens. */
  matcher: ['/((?!_next/static|_next/image|sw.js|manifest.webmanifest|icon|apple-touch-icon.png|offline.html|b/|f/|c/).*)']
};
