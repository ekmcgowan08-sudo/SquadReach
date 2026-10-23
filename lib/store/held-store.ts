/* Where held work lives between launches: IndexedDB (a 56-row flush is too
   big to trust to localStorage alone), mirrored to localStorage so the
   synchronous pagehide net has somewhere to write when an async IndexedDB
   transaction would not finish before the tab is frozen. On read, the
   newer of the two copies wins.

   ERASING IS GATED. Writing is safe any time; removing is not. A persist
   that fires during boot — before this session has read the key — would
   delete work this session never saw. So write() and remove() are refused
   until read() has run, and the pagehide net only ever writes. */
import { createStore, del, get, set } from 'idb-keyval';
import { HELD_KEY, type HeldStore } from '@/lib/held';

type Stamped = HeldStore & { savedAt: number };

let idb: ReturnType<typeof createStore> | null = null;
let readDone = false;

function store() {
  if (typeof indexedDB === 'undefined') return null;
  try {
    idb ??= createStore('squadrise', 'held');
    return idb;
  } catch {
    return null;
  }
}

function readLocal(): Stamped | null {
  try {
    const raw = localStorage.getItem(HELD_KEY);
    return raw ? (JSON.parse(raw) as Stamped) : null;
  } catch {
    return null;
  }
}

export async function readHeld(): Promise<unknown> {
  let fromIdb: Stamped | null = null;
  try {
    const s = store();
    fromIdb = s ? ((await get(HELD_KEY, s)) as Stamped | undefined) ?? null : null;
  } catch {
    fromIdb = null;
  }
  const fromLs = readLocal();
  readDone = true;
  if (fromIdb && fromLs) return (fromLs.savedAt || 0) > (fromIdb.savedAt || 0) ? fromLs : fromIdb;
  return fromIdb ?? fromLs;
}

export function heldReadDone() {
  return readDone;
}

/** Synchronous mirror. Safe to call from pagehide. */
export function writeHeldSync(h: HeldStore): void {
  if (!readDone) return;
  try {
    localStorage.setItem(HELD_KEY, JSON.stringify({ ...h, savedAt: Date.now() }));
  } catch {
    /* storage full or blocked */
  }
}

export async function writeHeld(h: HeldStore): Promise<void> {
  if (!readDone) return;
  const stamped: Stamped = { ...h, savedAt: Date.now() };
  try {
    localStorage.setItem(HELD_KEY, JSON.stringify(stamped));
  } catch {
    /* fall through to IndexedDB */
  }
  try {
    const s = store();
    if (s) await set(HELD_KEY, stamped, s);
  } catch {
    /* the localStorage mirror still holds it */
  }
}

export async function removeHeld(): Promise<void> {
  if (!readDone) return;
  try {
    localStorage.removeItem(HELD_KEY);
  } catch {
    /* ignore */
  }
  try {
    const s = store();
    if (s) await del(HELD_KEY, s);
  } catch {
    /* ignore */
  }
}
