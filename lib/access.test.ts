import { describe, expect, it } from 'vitest';
import { decidedRequests, decisionLine } from '@/lib/access';
import type { AccessRequest } from '@/lib/types/model';

const req = (p: Partial<AccessRequest>): AccessRequest => ({
  id: 'r', name: 'Sam Ortiz', email: '', personType: 'Volunteer', household: '', meta: '', requestedRole: 'coach', flagged: false, note: '', at: 1, status: 'pending', ...p
});

describe('a decided access request', () => {
  it('says what they were let in as, by whom and when', () => {
    expect(decisionLine(req({ status: 'approved', decidedBy: 'Pastor Mike', decidedAt: Date.UTC(2026, 9, 27, 20, 15) }))).toMatch(/^Approved as Coach by Pastor Mike · Oct 27, \d{1,2}:15 [AP]M$/);
    expect(decisionLine(req({ status: 'approved', grantedRole: 'scorekeeper', decidedBy: 'Pastor Mike' }))).toBe('Approved as Scorekeeper (asked for Coach) by Pastor Mike');
    expect(decisionLine(req({ status: 'denied' }))).toBe('Denied · asked for Coach');
    expect(decisionLine(req({}))).toBe('');
  });

  it('lists the newest decisions first', () => {
    const list = [req({ id: 'a', status: 'approved', decidedAt: 10 }), req({ id: 'b' }), req({ id: 'c', status: 'denied', decidedAt: 30 }), req({ id: 'd', status: 'approved', at: 20 })];
    expect(decidedRequests(list, 2).map((r) => r.id)).toEqual(['c', 'd']);
  });
});
