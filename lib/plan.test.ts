import { describe, expect, it } from 'vitest';
import { demoPlan } from '@/lib/data/seed-plan';
import { advent1, churchYear, easter, weekdayOf } from '@/lib/liturgical';
import { classesInPlan, emptyPlan, gradeIn, journeyYears, nightsOf, orderOf, seasonsOf, teachingByNight, timings, yearOf } from '@/lib/plan';

describe('the church year', () => {
  it('computes Easter for published dates', () => {
    const known: Record<number, string> = { 1961: '1961-04-02', 2000: '2000-04-23', 2008: '2008-03-23', 2011: '2011-04-24', 2019: '2019-04-21', 2024: '2024-03-31', 2025: '2025-04-20', 2026: '2026-04-05', 2027: '2027-03-28', 2038: '2038-04-25', 2285: '2285-03-22' };
    for (const [y, d] of Object.entries(known)) expect(easter(Number(y)), y).toBe(d);
  });

  it('starts Advent on the fourth Sunday before Christmas', () => {
    expect(advent1(2026)).toBe('2026-11-29');
    expect(advent1(2022)).toBe('2022-11-27');
    expect(advent1(2023)).toBe('2023-12-03');
    for (let y = 1990; y < 2060; y++) expect(weekdayOf(advent1(y))).toBe(0);
  });

  it('never puts the Baptism of the Lord on Epiphany', () => {
    for (let y = 1990; y < 2060; y++) {
      const c = churchYear(y);
      const ep = c.find((x) => x.id === 'epiphany')!.date;
      const bap = c.find((x) => x.id === 'baptism')!.date;
      expect(bap > ep).toBe(true);
      expect(weekdayOf(bap)).toBe(0);
    }
  });

  it('puts every movable day on its weekday', () => {
    for (let y = 1990; y < 2060; y++) {
      const c = Object.fromEntries(churchYear(y).map((x) => [x.id, x.date]));
      expect(weekdayOf(c.ash)).toBe(3);
      expect(weekdayOf(c.palm)).toBe(0);
      expect(weekdayOf(c.maundy)).toBe(4);
      expect(weekdayOf(c.goodfriday)).toBe(5);
      expect(weekdayOf(c.ascension)).toBe(4);
      expect(weekdayOf(c.pentecost)).toBe(0);
      expect(weekdayOf(c.christking)).toBe(0);
    }
  });
});

describe('the plan', () => {
  const p = demoPlan(0);

  it('lists the gathering nights, minus blackouts', () => {
    const nights = nightsOf(p, 0);
    expect(nights[0]).toBe('2026-08-05');
    expect(nights.every((n) => weekdayOf(n) === 3)).toBe(true);
    expect(nights).not.toContain('2026-11-25');
    expect(nights).not.toContain('2026-12-23');
    expect(nights).toContain('2026-10-28');
    expect(yearOf(p, '2027-03-03')).toBe(0);
    expect(yearOf(p, '2027-08-04')).toBe(1);
  });

  it('cuts the year into seasons that start on a night and do not overlap', () => {
    const s = seasonsOf(p, 0);
    expect(s.map((x) => x.id)).toEqual(['fall', 'advent', 'winter', 'lent', 'spring', 'summer']);
    expect(s.find((x) => x.id === 'advent')!.from).toBe('2026-11-29');
    expect(s.find((x) => x.id === 'lent')!.from).toBe('2027-02-10');
    for (let i = 1; i < s.length; i++) expect(s[i].from > s[i - 1].to).toBe(true);
    expect(s.reduce((n, x) => n + x.nights.length, 0)).toBe(nightsOf(p, 0).length);
  });

  it('lays the series back to back across the nights', () => {
    const t = teachingByNight(p, 0);
    expect(t['2026-09-02'].series.title).toBe('Alive: Ephesians');
    expect(t['2026-09-02'].week).toBe(1);
    expect(t['2026-10-28'].week).toBe(9);
    expect(t['2026-11-04'].series.title).toBe('Hard Questions');
  });

  it('measures a night against its plan', () => {
    const tm = timings(p, '2026-10-21');
    expect(tm.recorded).toBe(true);
    expect(tm.rows.find((r) => r.id === 'teaching')!.off).toBe(6);
    expect(tm.net).toBe(6 - 6 + 3);
    expect(orderOf(p, '2027-01-06').length).toBe(p.blocks.filter((b) => b.on).length);
  });
});

describe('following a class', () => {
  const p = emptyPlan(2026);
  it('names the classes in the plan, newest first, and their grade each year', () => {
    expect(classesInPlan(p)).toEqual([2033, 2032, 2031, 2030, 2029, 2028, 2027]);
    expect(gradeIn(p, 2033, 0)).toBe(6);
    expect(gradeIn(p, 2033, 6)).toBe(12);
    expect(gradeIn(p, 2030, 0)).toBe(9);
  });
  it('walks one student through their years, a repeated grade taking two', () => {
    expect(journeyYears(p, 2033, { enter: 6, last: 12, repeat: null }).map((x) => x.y + ':' + x.grade)).toEqual(['0:6', '1:7', '2:8', '3:9', '4:10', '5:11', '6:12']);
    expect(journeyYears(p, 2033, { enter: 8, last: 10, repeat: null }).map((x) => x.y + ':' + x.grade)).toEqual(['2:8', '3:9', '4:10']);
    expect(journeyYears(p, 2033, { enter: 6, last: 12, repeat: 8 }).map((x) => x.y + ':' + x.grade)).toEqual(['0:6', '1:7', '2:8', '3:8', '4:9', '5:10', '6:11']);
    expect(journeyYears(p, 2030, { enter: 6, last: 12, repeat: null }).map((x) => x.y + ':' + x.grade)).toEqual(['0:9', '1:10', '2:11', '3:12']);
  });
});
