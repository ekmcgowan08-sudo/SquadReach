import { describe, expect, it } from 'vitest';
import { awardOpen, awardStatus } from '@/lib/awards';

describe('award voting window', () => {
  it('is closed whenever a leader closed it by hand', () => {
    expect(awardOpen({ votingOpen: false }, '2026-10-27')).toBe(false);
    expect(awardStatus({ votingOpen: false, votingStartDate: '2026-10-01' }, '2026-10-27')).toBe('Closed · by hand');
  });
  it('opens on the start day and stays open through the end day', () => {
    const a = { votingOpen: true, votingStartDate: '2026-11-01', votingEndDate: '2026-11-04' };
    expect(awardOpen(a, '2026-10-31')).toBe(false);
    expect(awardStatus(a, '2026-10-31')).toBe('Scheduled · starts Nov 1');
    expect(awardOpen(a, '2026-11-01')).toBe(true);
    expect(awardOpen(a, '2026-11-04')).toBe(true);
    expect(awardStatus(a, '2026-11-02')).toBe('Open · closes after Nov 4');
    expect(awardOpen(a, '2026-11-05')).toBe(false);
    expect(awardStatus(a, '2026-11-05')).toBe('Closed · ended Nov 4');
  });
  it('with no dates is open while it is switched on', () => {
    expect(awardOpen({ votingOpen: true }, '2026-10-27')).toBe(true);
    expect(awardStatus({ votingOpen: true, votingStartDate: null, votingEndDate: null }, '2026-10-27')).toBe('Open');
  });
});
