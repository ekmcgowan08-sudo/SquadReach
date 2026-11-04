import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '@/lib/data/empty';
import { SEASON_QUESTIONS, answerOf, nextSeasonName, nextWeekday, planStartFor, planYears, scoringOn, seasonAnswered, seasonSettings, withPlan, yearPlan, type SavedSeason } from '@/lib/season';

const q = (id: string) => SEASON_QUESTIONS.find((x) => x.id === id)!;

describe('the season interview', () => {
  it('has seventeen questions, each in a review group', () => {
    expect(SEASON_QUESTIONS).toHaveLength(17);
    expect(new Set(SEASON_QUESTIONS.map((x) => x.id)).size).toBe(17);
  });

  it('tells a skipped answer from a given one', () => {
    expect(seasonAnswered({}, 'weeks')).toBe(false);
    expect(seasonAnswered({ earn: [] }, 'earn')).toBe(false);
    expect(seasonAnswered({ weeks: 6 }, 'weeks')).toBe(true);
    expect(answerOf({}, q('weeks'), '2026-08-01')).toBe(9);
  });

  it('starts a skipped start date on the next meeting night', () => {
    expect(nextWeekday('2026-08-01', 'Wednesday')).toBe('2026-08-05');
    expect(answerOf({ night: 'Sunday' }, q('start'), '2026-08-01')).toBe('2026-08-02');
  });

  it('writes the settings the answers imply', () => {
    const s = seasonSettings({ start: '2026-09-01', night: 'Wednesday', weeks: 4, growth: 0, verses: 'off', parents: 'no', game: 'none', name: 'Fall 2026' }, DEFAULT_CONFIG, '2026-08-20');
    expect(s.meetingDates).toEqual(['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-23']);
    expect(s.seasonWeeks).toBe(4);
    expect(s.weekNumber).toBe(1);
    expect(s.weekGrowthPct).toBe(0);
    expect(s.verseBoard).toBe(0);
    expect(s.parentShare?.standings).toBe(false);
    expect(s.gameSetup?.gameWeeks).toEqual([]);
    expect(s.seasonName).toBe('Fall 2026');
  });

  it('names the next season a year on', () => {
    expect(nextSeasonName('Fall 2025')).toBe('Fall 2026');
    expect(nextSeasonName('Summer short season')).toBe('Summer short season (next)');
  });
});

describe('a season with no points', () => {
  it('turns the leaderboard off, and the parent board’s rankings with it', () => {
    const s = seasonSettings({ carry: 'none', parents: 'yes', start: '2027-06-09', night: 'Wednesday' }, { ...DEFAULT_CONFIG, parentShare: { standings: true, mvp: true, verse: true, photos: true, calendar: true } }, '2027-06-01');
    expect(s.scoring).toBe(false);
    expect(scoringOn(s)).toBe(false);
    expect(s.parentShare).toEqual({ standings: false, mvp: false, verse: true, photos: true, calendar: true });
    expect(seasonSettings({ carry: 'both' }, DEFAULT_CONFIG, '2027-06-01').scoring).toBe(true);
    expect(scoringOn({})).toBe(true);
  });
});

describe('the whole horizon at once', () => {
  let n = 0;
  const id = () => 'p' + n++;

  it('starts on the first meeting night of next January', () => {
    expect(planStartFor('2026-11-04', 'Wednesday')).toBe('2027-01-06');
    expect(planStartFor('2026-11-04', 'Sunday')).toBe('2027-01-03');
  });

  it('builds three seasons a year, one of them scored, each year a draft, 52 weeks apart', () => {
    const plan = yearPlan(2, '2027-01-04', 'Wednesday', id, 0);
    expect(plan.map((s) => s.name)).toEqual(['Winter/Spring 2027', 'Summer 2027', 'Fall/Winter 2027', 'Winter/Spring 2028', 'Summer 2028', 'Fall/Winter 2028']);
    expect(plan.map((s) => s.answers.start)).toEqual(['2027-01-06', '2027-06-09', '2027-09-01', '2028-01-05', '2028-06-07', '2028-08-30']);
    expect(plan.map((s) => s.answers.carry)).toEqual(['both', 'none', 'none', 'both', 'none', 'none']);
    expect(plan.every((s) => s.plan?.draft && !s.active)).toBe(true);
    expect(planYears(plan).map((y) => [y.year, y.drafts])).toEqual([[2027, 3], [2028, 3]]);
  });

  it('keeps it between one and ten years', () => {
    expect(yearPlan(40, '2027-01-06', 'Wednesday', id, 0)).toHaveLength(30);
    expect(yearPlan(0, '2027-01-06', 'Wednesday', id, 0)).toHaveLength(21);
  });

  it('replaces only the plan: saved seasons and the one running stay', () => {
    const saved: SavedSeason = { id: 's', name: 'Fall 2026', answers: {}, active: false, savedAt: 0 };
    const old = yearPlan(1, '2027-01-06', 'Wednesday', id, 0);
    const running = { ...old[0], active: true };
    const next = withPlan([saved, running, ...old.slice(1)], yearPlan(1, '2028-01-05', 'Wednesday', id, 0));
    expect(next.filter((s) => !s.plan).map((s) => s.name)).toEqual(['Fall 2026', 'Winter/Spring 2027']);
    expect(next.find((s) => s.name === 'Winter/Spring 2027')?.active).toBe(true);
    expect(planYears(next).map((y) => y.year)).toEqual([2028]);
    expect(withPlan(next, []).map((s) => s.name)).toEqual(['Fall 2026', 'Winter/Spring 2027']);
  });
});
