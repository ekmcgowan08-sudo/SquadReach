import { describe, expect, it } from 'vitest';
import { DEMO_NIGHT, demoNightFor, moveDemo, shiftDates } from '@/lib/data/demo-week';
import { demoMinistry } from '@/lib/data/seed';
import { atLocal } from '@/lib/cycle';

describe('the demo’s week 9 is always the coming Wednesday', () => {
  it('stays on its own night until then, and a Wednesday counts until noon', () => {
    expect(demoNightFor(atLocal('2026-10-23', '12:00'))).toBe(DEMO_NIGHT);
    expect(demoNightFor(atLocal('2026-10-28', '09:00'))).toBe('2026-10-28');
    expect(demoNightFor(atLocal('2026-10-28', '13:00'))).toBe('2026-11-04');
    expect(demoNightFor(atLocal('2026-11-01', '05:00'))).toBe('2026-11-04');
    expect(demoNightFor(atLocal('2027-03-17', '08:00'))).toBe('2027-03-17');
  });

  it('moves every date by whole weeks — values, keys and date-times alike', () => {
    const moved = shiftDates({ night: '2026-10-28', due: '2026-10-28T18:00', byNight: { '2026-10-21': 1, 'Ellison|2026-10-28': 'yes' }, at: 20261028, text: 'Fall 2026 · 2026–27' }, 7);
    expect(moved).toEqual({ night: '2026-11-04', due: '2026-11-04T18:00', byNight: { '2026-10-28': 1, 'Ellison|2026-11-04': 'yes' }, at: 20261028, text: 'Fall 2026 · 2026–27' });
  });

  it('brings the whole ministry along, with the words written from its dates', () => {
    const d = moveDemo(demoMinistry(atLocal('2026-10-23', '12:00')), DEMO_NIGHT, '2026-12-30');
    expect(d.tonight.date).toBe('2026-12-30');
    expect(d.config.meetingDates.at(-1)).toBe('2026-12-30');
    expect(new Date(d.config.meetingDates[0] + 'T00:00:00').getDay()).toBe(3);
    const finale = d.events.find((e) => e.id === 'e4')!;
    expect([finale.iso, finale.date]).toEqual(['2027-01-21', 'Jan 21']);
    expect(d.slips.find((s) => s.id === 'retreat')?.title).toBe('Fall retreat · Jan 15–17');
  });
});
