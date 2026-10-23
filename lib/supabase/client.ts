'use client';
import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';

let client: ReturnType<typeof createBrowserClient> | null = null;

/** The browser client. Row-level security is what keeps each role inside
 *  its lane — the anon key grants nothing on its own. */
export function supabaseBrowser() {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
