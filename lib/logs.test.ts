import { describe, expect, it } from 'vitest';
import { logsFromLedger } from '@/lib/logs';
import type { LedgerEntry } from '@/lib/types/model';

const e = (p: Partial<LedgerEntry>): LedgerEntry => ({ id: 'x', team: 'yellow', cat: 'general', amount: 10, by: 'Coach', why: '', at: new Date('2026-10-28T19:00:00').getTime(), status: 'approved', ...p }) as LedgerEntry;
const dates = ['2026-10-21', '2026-10-28'];

describe('logs from the ledger', () => {
  it('reads friends and verses out of check-in detail', () => {
    const { visitorLog, verseLog } = logsFromLedger(
      [
        e({ id: 'v', cat: 'visitors', student: 'Ellison Reid', detail: { friends: ['Kai', 'Max'], friendKind: 'new' }, amount: 1200 }),
        e({ id: 'b', cat: 'verses', student: 'Luke Jarvis', detail: { verses: 3, verseSet: 'sunday' }, amount: 60 })
      ],
      dates
    );
    expect(visitorLog).toEqual([expect.objectContaining({ id: 'v', names: ['Kai', 'Max'], student: 'Ellison Reid', week: 2, kind: 'new' })]);
    expect(verseLog).toEqual([expect.objectContaining({ id: 'b', count: 3, set: 'sunday', pts: 60, week: 2 })]);
  });

  it('drops what was rejected or reversed', () => {
    const { visitorLog } = logsFromLedger(
      [
        e({ id: 'v1', cat: 'visitors', student: 'A', detail: { friends: ['Kai'] } }),
        e({ id: 'u1', cat: 'visitors', student: 'A', amount: -10, reverses: 'v1' }),
        e({ id: 'v2', cat: 'visitors', student: 'B', detail: { friends: ['Max'] }, status: 'rejected' }),
        e({ id: 'v3', cat: 'visitors', student: 'C', detail: { friends: ['Sam'] }, status: 'pending' })
      ],
      dates
    );
    expect(visitorLog.map((r) => r.id)).toEqual(['v3']);
  });
});
