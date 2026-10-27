import { describe, expect, it } from 'vitest';
import { corrections } from '@/lib/corrections';
import { demoMinistry } from '@/lib/data/seed';
import type { LedgerEntry } from '@/lib/types/model';

const entry = (p: Partial<LedgerEntry>): LedgerEntry => ({ id: 'e', team: 'blue', cat: 'games', amount: 300, by: 'Carla', why: 'won', at: 0, status: 'approved', ...p });

describe('a correction after the night’s report', () => {
  const d = demoMinistry();
  const CLOSED = 1_000_000;
  d.ledger = [
    entry({ id: 'before', at: CLOSED - 60_000 }),
    entry({ id: 'undo-before', at: CLOSED + 60_000, amount: -300, reverses: 'before' }),
    entry({ id: 'after', at: CLOSED + 30_000 }),
    entry({ id: 'undo-after', at: CLOSED + 90_000, amount: -300, reverses: 'after' }),
    entry({ id: 'early', at: CLOSED - 90_000, amount: 50 }),
    entry({ id: 'undo-early', at: CLOSED - 30_000, amount: -50, reverses: 'early' })
  ];

  it('is a reversal after the close of something the report had', () => {
    d.huddle.nightClosed = true;
    d.huddle.closedAt = CLOSED;
    const c = corrections(d);
    expect(c.map((x) => x.id)).toEqual(['undo-before']);
    expect(c[0].line).toBe('Blue −300 Games — 300 from the night’s report was taken back');
  });

  it('does not exist while the night is still open', () => {
    d.huddle.nightClosed = false;
    expect(corrections(d)).toEqual([]);
  });
});
