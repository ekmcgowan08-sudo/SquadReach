/* SquadRise runs with no configuration at all (demo mode). Setting both of
   these switches it to the real backend. Read at build time on the client. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const isSupabaseConfigured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
