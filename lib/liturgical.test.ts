import { describe, expect, it } from 'vitest';
import { churchSeasonOn } from '@/lib/liturgical';

describe('churchSeasonOn', () => {
  it('reads Ordinary Time in the fall, with Advent next', () => {
    expect(churchSeasonOn('2026-10-27')).toEqual({ now: { name: 'Ordinary Time', from: '2026-05-25', to: '2026-11-28' }, next: { name: 'Advent', from: '2026-11-29' } });
  });
  it('names the season a date is inside', () => {
    expect(churchSeasonOn('2026-12-10').now.name).toBe('Advent');
    expect(churchSeasonOn('2026-12-10').next).toEqual({ name: 'Christmas season', from: '2026-12-25' });
    expect(churchSeasonOn('2026-03-30').now.name).toBe('Holy Week');
    expect(churchSeasonOn('2026-03-30').next.name).toBe('Easter season');
  });
  it('fills the gap after Christmas with Ordinary Time until Lent', () => {
    expect(churchSeasonOn('2027-01-20')).toEqual({ now: { name: 'Ordinary Time', from: '2027-01-06', to: '2027-02-09' }, next: { name: 'Lent', from: '2027-02-10' } });
  });
  it('calls the day between Easter season and Ordinary Time Pentecost', () => {
    expect(churchSeasonOn('2026-05-24').now.name).toBe('Pentecost');
    expect(churchSeasonOn('2026-05-24').next).toEqual({ name: 'Ordinary Time', from: '2026-05-25' });
  });
});
