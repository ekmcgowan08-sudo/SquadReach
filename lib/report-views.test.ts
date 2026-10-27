import { describe, expect, it } from 'vitest';
import { demoMinistry } from '@/lib/data/seed';
import { attendanceByWeek, bibleByWeek, squadTrends } from '@/lib/report-views';
import { teamTotal } from '@/lib/scoring';

const d = demoMinistry();
const today = '2026-10-28';

describe('the season at a glance', () => {
  it('reads one value per week that has started', () => {
    expect(attendanceByWeek(d, today)).toHaveLength(9);
    expect(attendanceByWeek(d, '2026-09-10')).toHaveLength(2);
    for (const w of attendanceByWeek(d, today)) expect(w.value).toBeGreaterThanOrEqual(0);
    expect(attendanceByWeek(d, today).every((w) => w.value <= 100)).toBe(true);
  });
  it('counts people who practiced, not practice rows', () => {
    const weeks = bibleByWeek(d, today);
    const people = new Set(d.practiceLog.map((p) => p.who)).size;
    expect(weeks.every((w) => w.value <= people)).toBe(true);
  });
  it('ends each squad’s trend on its total', () => {
    for (const s of squadTrends(d, today)) {
      expect(s.weeks[s.weeks.length - 1].value).toBe(teamTotal(d.ledger, s.team));
    }
  });
});
