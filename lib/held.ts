/* ─────────────────────────────────────────────────────────────────────────
   HELD WORK — the gym problem.

   public/sw.js is network-first and caches no reads, which is right: a
   stale score during a live event is worse than none. But it has no answer
   for WRITES, and a volunteer coach marking 28 names on one bar of signal is
   the case this app exists for. So every write made without signal is held
   on the phone and replays in order the moment there is signal again.

   Held work must outlive the tab. iOS kills a backgrounded tab; if the
   queue lived in React state, 28 check-ins would die there and the banner
   that said "nothing is lost" would be a lie. So it persists to its OWN
   key (IndexedDB, see lib/store/held-store.ts) on every change.

   These are the pure rules; the store applies them.
   ───────────────────────────────────────────────────────────────────────── */
import type { ChatMessage, HeldOp, Rsvp } from '@/lib/types/model';

export const HELD_KEY = 'squadrise_held_v1';

/** "Signal dropped mid-game" vs "this phone sat in a drawer since last
 *  Wednesday". Younger work drains on its own; older work is quarantined
 *  and the coach decides, because only they know which night it belongs to. */
export const HELD_STALE_MS = 10 * 60 * 60 * 1000;

export interface HeldChat {
  threadId: string;
  msg: ChatMessage;
}

export interface HeldRsvp {
  eventId: string;
  name: string;
  rec: Rsvp;
}

export interface HeldPayload {
  outbox: HeldOp[];
  chat: HeldChat[];
  rsvp: HeldRsvp[];
  since: number;
}

export interface HeldStore extends HeldPayload {
  stale: HeldPayload | null;
}

/** Only rows that can actually be replayed survive a restore. */
export function cleanHeld(p: unknown, now = Date.now()): HeldPayload {
  const o = (p && typeof p === 'object' ? p : {}) as Partial<HeldPayload>;
  return {
    outbox: (Array.isArray(o.outbox) ? o.outbox : []).filter(
      (r): r is HeldOp =>
        !!r && typeof r.id === 'string' && typeof r.at === 'number' &&
        ((r.kind === 'entry' && !!r.entry && typeof r.entry.amount === 'number' && !!r.entry.team && !!r.entry.cat) ||
          (r.kind === 'decide' && Array.isArray(r.ids) && !!r.status))
    ),
    chat: (Array.isArray(o.chat) ? o.chat : []).filter((r): r is HeldChat => !!r && !!r.threadId && !!r.msg && !!r.msg.id),
    rsvp: (Array.isArray(o.rsvp) ? o.rsvp : []).filter((r): r is HeldRsvp => !!r && !!r.eventId && !!r.name && !!r.rec),
    since: typeof o.since === 'number' ? o.since : now
  };
}

export const heldEmpty = (p: HeldPayload | null | undefined) => !p || (!p.outbox.length && !p.chat.length && !p.rsvp.length);
export const heldTotal = (p: HeldPayload | null | undefined) => (p ? p.outbox.length + p.chat.length + p.rsvp.length : 0);

export function mergeHeld(a: HeldPayload | null, b: HeldPayload | null): HeldPayload | null {
  if (!a) return b;
  if (!b) return a;
  return { outbox: a.outbox.concat(b.outbox), chat: a.chat.concat(b.chat), rsvp: a.rsvp.concat(b.rsvp), since: Math.min(a.since, b.since) };
}

/** The oldest moment across ALL THREE queues, not just points: a phone
 *  holding only a chat message still has an age the quarantine can judge.
 *  Ages come from stamps, never from display strings. */
export function heldSince(p: Omit<HeldPayload, 'since'>): number | null {
  const ats = [
    ...p.outbox.map((q) => q.at),
    ...p.chat.map((r) => r.msg.heldAt),
    ...p.rsvp.map((r) => r.rec.heldAt)
  ].filter((n): n is number => typeof n === 'number');
  return ats.length ? Math.min(...ats) : null;
}

/** What a stored payload means on open: work young enough to drain on its
 *  own, and work old enough to need a decision. */
export function classifyRestored(raw: unknown, now = Date.now()): { fresh: HeldPayload | null; stale: HeldPayload | null } {
  if (!raw || typeof raw !== 'object') return { fresh: null, stale: null };
  const r = raw as Partial<HeldStore>;
  let fresh: HeldPayload | null = cleanHeld(r, now);
  let stale: HeldPayload | null = r.stale ? cleanHeld(r.stale, now) : null;
  if (heldEmpty(fresh)) fresh = null;
  if (heldEmpty(stale)) stale = null;
  if (fresh && now - fresh.since > HELD_STALE_MS) {
    stale = mergeHeld(stale, fresh);
    fresh = null;
  }
  return { fresh, stale };
}

/** Merge restored ops into the live outbox. Id-guarded, so neither a restore
 *  nor a re-send can duplicate. */
export function mergeOutbox(live: HeldOp[], incoming: HeldOp[]): HeldOp[] {
  const have = new Set(live.map((q) => q.id));
  return live.concat(incoming.filter((q) => !have.has(q.id)));
}

/** Replay order: oldest first, so the ledger reads in the order it happened. */
export const replayOrder = (ops: HeldOp[]) => ops.slice().sort((a, b) => a.at - b.at);

/** Clear by id, NEVER `outbox = []`: anything queued while a flush was in
 *  flight has to survive it. */
export const withoutSent = (live: HeldOp[], sentIds: string[]) => {
  const sent = new Set(sentIds);
  return live.filter((q) => !sent.has(q.id));
};

/* ── done-flags ──────────────────────────────────────────────────────────
   A boolean can only say "done", so every label built on one silently
   re-asserts a post that is still sitting in the outbox. Flags record HOW
   an action completed: 'posted' | 'held' (or {count, held}). */
export type DoneFlag = 'posted' | 'held' | { count: number; held: boolean } | null | undefined;

export const wasHeld = (f: DoneFlag) => f === 'held' || (!!f && typeof f === 'object' && f.held);

export const postedLabel = (f: DoneFlag, postedMsg: string, heldMsg: string) => (wasHeld(f) ? heldMsg : postedMsg);

/** Once the queue is actually empty, a 'held' marker is a lie — promote it. */
export function promoteFlag(f: DoneFlag): DoneFlag {
  if (!wasHeld(f)) return f;
  return f && typeof f === 'object' ? { count: f.count, held: false } : 'posted';
}

/** Group held entries by squad × category: posting attendance for 28 is 56
 *  ledger rows, and a coach wants to know it is safe, not to audit it. */
export function groupHeldEntries(ops: HeldOp[]): { team: string; cat: string; count: number; amount: number }[] {
  const map = new Map<string, { team: string; cat: string; count: number; amount: number }>();
  for (const op of ops) {
    if (op.kind !== 'entry') continue;
    const k = op.entry.team + '|' + op.entry.cat;
    const g = map.get(k) ?? { team: op.entry.team, cat: op.entry.cat, count: 0, amount: 0 };
    g.count++;
    g.amount += op.entry.amount;
    map.set(k, g);
  }
  return [...map.values()];
}
