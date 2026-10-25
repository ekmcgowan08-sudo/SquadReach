/* Three-way merge for the documents leaders edit together (the plan, the
   reports, small groups…). Given what both sides started from (`base`),
   what I have now (`mine`) and what's on the server (`theirs`), keep every
   change either side made:

   - a value only one side changed takes that side's change;
   - objects merge key by key;
   - arrays of things with an `id` merge by id: both sides' additions are
     kept, a removal wins only if the other side left the thing untouched,
     and each surviving element merges recursively;
   - other arrays (tags, lists of names) merge as sets, in order;
   - when both sides changed the same plain value differently, mine wins —
     it's the edit the person in front of the screen just made.

   Pure, so the store, undo and the tests all agree. */

type Json = unknown;

const isObj = (v: Json): v is Record<string, Json> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function same(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as Json[];
    return a.length === bb.length && a.every((x, i) => same(x, bb[i]));
  }
  const ao = a as Record<string, Json>;
  const bo = b as Record<string, Json>;
  const ak = Object.keys(ao).filter((k) => ao[k] !== undefined);
  const bk = Object.keys(bo).filter((k) => bo[k] !== undefined);
  return ak.length === bk.length && ak.every((k) => same(ao[k], bo[k]));
}

/** What identifies an array element: its id, else its whole value. */
const identity = (v: Json): string => (isObj(v) && typeof v.id === 'string' ? 'id:' + v.id : 'v:' + JSON.stringify(v));

function mergeArrays(base: Json[], mine: Json[], theirs: Json[]): Json[] {
  const b = new Map(base.map((x) => [identity(x), x]));
  const m = new Map(mine.map((x) => [identity(x), x]));
  const t = new Map(theirs.map((x) => [identity(x), x]));
  const keep = (k: string): Json | undefined => {
    const inB = b.has(k);
    const inM = m.has(k);
    const inT = t.has(k);
    if (inM && inT) return merge3(b.get(k), m.get(k), t.get(k));
    if (!inB) return inM ? m.get(k) : t.get(k); // added on one side
    // in base, removed on one side: the removal stands unless the other side edited it
    if (inM && !inT) return same(m.get(k), b.get(k)) ? undefined : m.get(k);
    if (inT && !inM) return same(t.get(k), b.get(k)) ? undefined : t.get(k);
    return undefined;
  };
  /* Their order is the shared one; my additions go where I put them. */
  const out: Json[] = [];
  const seen = new Set<string>();
  const order = [...theirs.map(identity)];
  mine.forEach((x, i) => {
    const k = identity(x);
    if (t.has(k)) return;
    const prev = i > 0 ? identity(mine[i - 1]) : null;
    const at = prev ? order.indexOf(prev) : -1;
    order.splice(at + 1, 0, k);
  });
  for (const k of order) {
    if (seen.has(k)) continue;
    seen.add(k);
    const v = keep(k);
    if (v !== undefined) out.push(v);
  }
  return out;
}

export function merge3<T>(base: T | undefined, mine: T, theirs: T): T {
  if (same(mine, theirs)) return mine;
  if (same(mine, base)) return theirs;
  if (same(theirs, base)) return mine;
  /* I removed it, they changed it: their edit outlives my removal. */
  if (mine === undefined) return theirs;
  if (Array.isArray(mine) && Array.isArray(theirs)) return mergeArrays(Array.isArray(base) ? base : [], mine, theirs) as T;
  if (isObj(mine) && isObj(theirs)) {
    const b: Record<string, Json> = isObj(base) ? base : {};
    const out: Record<string, Json> = {};
    for (const k of new Set([...Object.keys(theirs), ...Object.keys(mine)])) {
      const v = merge3(b[k], mine[k], theirs[k]);
      if (v !== undefined) out[k] = v;
    }
    return out as T;
  }
  return mine;
}
