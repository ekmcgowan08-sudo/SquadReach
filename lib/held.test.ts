import { describe, expect, it } from 'vitest';
import {
  HELD_STALE_MS, classifyRestored, groupHeldEntries, heldSince, mergeOutbox, promoteFlag, replayOrder, wasHeld, withoutSent
} from '@/lib/held';
import type { HeldOp, LedgerEntry } from '@/lib/types/model';

const entry = (id: string, at: number, team = 'yellow', cat = 'general', amount = 50): HeldOp => ({
  kind: 'entry', id, at,
  entry: { id, team, cat, amount, by: 'Coach Chris', why: '', at, status: 'pending' } as LedgerEntry
});

describe('held work', () => {
  const now = 1_000_000_000_000;
  it('young work drains on its own; old work is quarantined for a decision', () => {
    const young = classifyRestored({ outbox: [entry('a', now - 60_000)], chat: [], rsvp: [], since: now - 60_000 }, now);
    expect(young.fresh?.outbox).toHaveLength(1);
    expect(young.stale).toBeNull();
    const old = classifyRestored({ outbox: [entry('a', now - HELD_STALE_MS - 1)], chat: [], rsvp: [], since: now - HELD_STALE_MS - 1 }, now);
    expect(old.fresh).toBeNull();
    expect(old.stale?.outbox).toHaveLength(1);
  });
  it('drops rows that cannot be replayed', () => {
    const r = classifyRestored({ outbox: [{ kind: 'entry', id: 'x', at: now }, entry('ok', now)], since: now }, now);
    expect(r.fresh?.outbox.map((o) => o.id)).toEqual(['ok']);
  });
  it('a held chat message alone still has an age', () => {
    expect(heldSince({ outbox: [], chat: [{ threadId: 't', msg: { id: 'm', day: '', time: '', text: 'hi', heldAt: 42 } }], rsvp: [] })).toBe(42);
  });
  it('restores are id-guarded — nothing duplicates', () => {
    const live = [entry('a', 1)];
    expect(mergeOutbox(live, [entry('a', 1), entry('b', 2)]).map((o) => o.id)).toEqual(['a', 'b']);
  });
  it('replays oldest first and clears by id, keeping work queued mid-flush', () => {
    const ops = [entry('b', 2), entry('a', 1)];
    expect(replayOrder(ops).map((o) => o.id)).toEqual(['a', 'b']);
    const liveAfter = [...ops, entry('c', 3)];
    expect(withoutSent(liveAfter, ['a', 'b']).map((o) => o.id)).toEqual(['c']);
  });
  it('a held flag is promoted once the queue is empty', () => {
    expect(wasHeld('held')).toBe(true);
    expect(promoteFlag('held')).toBe('posted');
    expect(promoteFlag({ count: 28, held: true })).toEqual({ count: 28, held: false });
    expect(promoteFlag('posted')).toBe('posted');
  });
  it('groups held entries by squad × category', () => {
    const g = groupHeldEntries([entry('a', 1), entry('b', 2), entry('c', 3, 'yellow', 'visitors')]);
    expect(g).toEqual([
      { team: 'yellow', cat: 'general', count: 2, amount: 100 },
      { team: 'yellow', cat: 'visitors', count: 1, amount: 50 }
    ]);
  });
});
