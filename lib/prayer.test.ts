import { describe, expect, it } from 'vitest';
import { prayerMine, prayerReadable, prayerTakeable } from '@/lib/prayer';
import type { Membership, PrayerQueued } from '@/lib/types/model';

const who = (displayName: string, persona: Membership['persona'], mode: Membership['mode'] = 'demo'): Membership => ({
  mode, persona, role: null, displayName, firstName: displayName.split(' ')[0], initials: 'X', membershipId: mode === 'supabase' ? 'm-' + displayName : null, orgId: null, teamId: null, studentName: null
});
const q = (p: Partial<PrayerQueued>): PrayerQueued => ({ id: 'q', who: 'Isaac Smith', meta: '', body: 'secret', at: 0, ...p });

describe('who reads a prayer request', () => {
  it('in the demo: only the leader who has it, and anyone takes one nobody has', () => {
    const mike = who('Pastor Mike', 'leader');
    const renee = who('Renee Boyd', 'owner');
    const dana = who('Dana Leader', 'leader');
    const his = q({ owner: 'Pastor Mike' });
    expect([prayerMine(his, mike), prayerReadable(his, mike)]).toEqual([true, true]);
    expect([prayerReadable(his, dana), prayerTakeable(his, dana)]).toEqual([false, false]);
    expect(prayerTakeable(his, renee)).toBe(true);
    expect(prayerTakeable(q({ owner: null }), dana)).toBe(true);
  });

  it('with Supabase: whatever the database said', () => {
    const me = who('Pastor Mike', 'leader', 'supabase');
    expect(prayerReadable(q({ sealed: true, owner: 'Pastor Mike' }), me)).toBe(false);
    expect(prayerMine(q({ mine: true, owner: 'Pastor Mike' }), me)).toBe(true);
    expect(prayerReadable(q({ sealed: false, mine: false }), me)).toBe(true);
  });
});
