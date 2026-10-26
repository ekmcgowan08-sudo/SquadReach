/* Where you've been, on the phone. Two small pieces of the screen map:

   · Recent — the deep screens you opened lately, shown as a row at the top
     of More once there are two. Kept per person on this device so it
     survives a reload; switching role or signing out clears it, so nobody
     lands on a screen their new role can't hold.
   · Back walks a real back stack: within the app it returns to whatever
     opened the screen; only a screen loaded cold falls back to its parent. */

const KEY = 'squadrise.recent.v1';
const MAX = 6;
/** The tab roots aren't "deep" — they're one tap away already. */
const ROOTS = new Set(['/dashboard', '/dashboard/score', '/dashboard/chat', '/dashboard/more', '/dashboard/bible']);

interface Stored {
  who: string;
  items: string[];
}

/** Whose list it is: the person, in the role they're using. */
export const recentsOwner = (m: { persona: string; membershipId: string | null; displayName: string }) => m.persona + ':' + (m.membershipId ?? m.displayName);

export const isDeep = (path: string) => path.startsWith('/dashboard/') && !ROOTS.has(path);

/** Adds a visit, most recent first, without repeats. Pure, for testing. */
export function withVisit(items: string[], path: string, max = MAX): string[] {
  return [path, ...items.filter((x) => x !== path)].slice(0, max);
}

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}
function write(s: Stored | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: Recent just doesn't persist */
  }
  listeners.forEach((f) => f());
}
const listeners = new Set<() => void>();
export const subscribeRecents = (f: () => void) => (listeners.add(f), () => void listeners.delete(f));

/** Another person's or role's list reads as empty. */
export function readRecents(who: string): string[] {
  const s = read();
  return s && s.who === who ? s.items : [];
}
/** A stable snapshot for useSyncExternalStore. */
let snap: { who: string; raw: string | null; items: string[] } = { who: '', raw: null, items: [] };
export function recentsSnapshot(who: string): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (snap.who !== who || snap.raw !== raw) snap = { who, raw, items: readRecents(who) };
  return snap.items;
}

export function noteVisit(who: string, path: string) {
  if (!isDeep(path)) return;
  write({ who, items: withVisit(readRecents(who), path) });
}
export const clearRecents = () => write(null);

/* ── the back stack ─────────────────────────────────────────────────── */
let depth = 0;
let last: string | null = null;
/** Called with every route the phone shell shows; only a change of route
 *  counts (a re-render or a role loading in is not a navigation). */
export const noteNavigation = (path: string) => {
  if (path === last) return;
  last = path;
  depth++;
};
/** True when the screen before this one was in the app, not a cold load. */
export const cameFromInApp = () => depth > 1;
