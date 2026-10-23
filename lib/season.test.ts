import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '@/lib/data/empty';
import { SEASON_QUESTIONS, answerOf, nextSeasonName, nextWeekday, seasonAnswered, seasonSettings } from '@/lib/season';

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
