/* Push, the parts the phone and the server share. What a push says and who
   it's for come from the database (supabase/migrations/…_push.sql); this
   is how a phone's own choices filter it, and what the service worker is
   handed to show. */

/** The key phones subscribe with. Without it (and VAPID_PRIVATE_KEY on the
 *  server) nothing is pushed, and notifications show in the app only. */
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

/** Does this phone want this push? Its own choice, else the ministry's
 *  default, else on — the same rule as the in-app list (lib/prefs notifOn). */
export function wantsPush(prefs: Record<string, unknown> | null | undefined, defaults: Record<string, unknown> | null | undefined, trigger: string): boolean {
  const mine = prefs?.[trigger];
  if (typeof mine === 'boolean') return mine;
  const ministry = defaults?.[trigger];
  if (typeof ministry === 'boolean') return ministry;
  return true;
}

/** What public/sw.js reads off a push. */
export interface PushPayload {
  title: string;
  body: string;
  url: string;
  /** One notification per thing: a second push for it replaces the first. */
  tag: string;
}

/** A push that waited longer than this isn't sent: an hour-old "are you
 *  coming tonight?" is noise. */
export const PUSH_FRESH_MS = 15 * 60_000;

/** The applicationServerKey PushManager.subscribe wants, from the URL-safe
 *  base64 key. */
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** "Send a test" from Notifications. */
export const PUSH_TEST: PushPayload = {
  title: 'SquadRise is set up on this phone',
  body: 'This is what a lead change or an approval will look like.',
  url: '/dashboard/notifications',
  tag: 'sr-test'
};
