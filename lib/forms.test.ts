import { describe, expect, it } from 'vitest';
import { demoMinistry } from '@/lib/data/seed';
import { hereWithoutForms, missingForms, tripBlock, tripMoney, tripRoster } from '@/lib/forms';
import type { MinistryEvent, PermissionSlip } from '@/lib/types/model';

const slip = (p: Partial<PermissionSlip>): PermissionSlip => ({ id: 's', title: 'Form', due: '2026-11-01', kids: 'all', at: 0, ...p });
const trip: MinistryEvent = { id: 'retreat', title: 'Fall retreat', meta: '', date: 'Nov 8', color: '#968ae0', roles: ['members', 'captains'], trip: { cost: 120 } };

function setup() {
  const d = demoMinistry();
  d.slips = [
    slip({ id: 'med', title: 'Medical 2026', kind: 'medical' }),
    slip({ id: 'photo', title: 'Photo release', kind: 'photo' }),
    slip({ id: 'waiver', title: 'Fall retreat waiver', kind: 'waiver', event: 'retreat' }),
    slip({ id: 'other-trip', title: 'Ski trip waiver', kind: 'waiver', event: 'ski' })
  ];
  d.slipSigned = {};
  d.events = [...d.events, trip];
  const a = d.roster.find((s) => !s.guest)!.name;
  return { d, a };
}

describe('forms', () => {
  it('block for medical, emergency, permission and waivers; a photo release only warns', () => {
    const { d, a } = setup();
    const f = missingForms(d, a, 'retreat');
    expect(f.blocking.map((s) => s.id)).toEqual(['med', 'waiver']);
    expect(f.warning.map((s) => s.id)).toEqual(['photo']);
  });

  it('count a trip’s waiver only for that trip', () => {
    const { d, a } = setup();
    expect(missingForms(d, a).blocking.map((s) => s.id)).toEqual(['med']);
    expect(missingForms(d, a, 'ski').blocking.map((s) => s.id)).toEqual(['med', 'other-trip']);
  });

  it('keep a student off a trip until a parent signs, and say which', () => {
    const { d, a } = setup();
    expect(tripBlock(d, trip, a)).toBe('Not signed yet: Medical & allergies, Fall retreat waiver. A parent signs from the family link.');
    d.slipSigned['med|' + a] = { by: 'Mom', at: 1 };
    d.slipSigned['waiver|' + a] = { by: 'Mom', at: 1 };
    expect(tripBlock(d, trip, a)).toBeNull();
    expect(tripBlock(d, { ...trip, trip: null }, 'Anyone')).toBeNull();
  });

  it('never keep anyone out tonight — leaders just see who to text', () => {
    const { d, a } = setup();
    d.tonight.presence = { [a]: true };
    expect(hereWithoutForms(d)).toEqual([{ name: a, forms: [expect.objectContaining({ id: 'med' })] }]);
  });
});

describe('camp money', () => {
  it('is counted only once the office confirms it', () => {
    const { d, a } = setup();
    d.payments = [
      { id: 'p1', event: 'retreat', student: a, amount: 60, by: 'Coach Chris', at: 1 },
      { id: 'p2', event: 'retreat', student: a, amount: 40, by: 'Coach Chris', at: 2, confirmedBy: 'Office', confirmedAt: 3 }
    ];
    expect(tripMoney(d, trip)).toMatchObject({ counted: 40, unconfirmed: 60 });
    const row = tripRoster(d, trip).find((r) => r.name === a)!;
    expect(row).toMatchObject({ paid: 40, unconfirmed: 60 });
    expect(tripRoster(d, trip)[0].blocking.length).toBeGreaterThan(0);
  });
});
