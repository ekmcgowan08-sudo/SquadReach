import { describe, expect, it } from 'vitest';
import { LIVE_DEFAULTS, LIVE_TEMPLATES, leaderboard, pendingWords, pointsFor, publicResults, roomActivity, sideFor, sidesFor, simulatedAnswers, summaryLine, tally, verseParts, type LiveActivity, type LiveAnswer } from '@/lib/live';

const act = (id: string, k: keyof typeof LIVE_TEMPLATES): LiveActivity => ({ id, ...LIVE_TEMPLATES[k]() });
const ans = (act: string, member: string, at: number, value: LiveAnswer['value'], side?: 0 | 1): LiveAnswer => ({ act, member, name: member.toUpperCase(), nick: member + '!', at, value, side });
const S = LIVE_DEFAULTS;
const SIDES: [string, string] = ['Red', 'Blue'];

describe('live ministry time', () => {
  it('splits a verse into text and blanks', () => {
    expect(verseParts('Be [strong] and [courageous].')).toEqual([
      { t: 'Be ', blank: false },
      { t: 'strong', blank: true },
      { t: ' and ', blank: false },
      { t: 'courageous', blank: true },
      { t: '.', blank: false }
    ]);
  });

  it('never shows the room a correct answer or a blank before reveal', () => {
    const t = act('t', 'trivia');
    const r = roomActivity(t, S, SIDES, false);
    expect(JSON.stringify(r)).not.toContain('correct');
    const v = roomActivity(act('v', 'verse'), S, SIDES, false);
    expect(v.verse!.filter((p) => p.blank).every((p) => /^_+$/.test(p.t))).toBe(true);
    expect(roomActivity(act('v', 'verse'), S, SIDES, true).verse!.some((p) => p.t === 'courageous')).toBe(true);
  });

  it('keeps results off the room until allowed, and the right answer until the reveal', () => {
    const r = { kind: 'choice' as const, counts: [1, 2, 0, 0], correct: 1 };
    expect(publicResults(r, false, { results: 'reveal' }, 'activity')).toBeNull();
    expect(publicResults(r, false, { results: 'live' }, 'board')).toBeNull();
    expect(publicResults(r, false, { results: 'live' }, 'activity')).toEqual({ ...r, correct: null });
    expect(publicResults(r, true, { results: 'reveal' }, 'activity')).toEqual(r);
  });

  it('counts each person once, by their latest answer', () => {
    const t = act('t', 'trivia');
    const r = tally(t, [ans('t', 'a', 1, { choice: 0 }), ans('t', 'a', 2, { choice: 1 }), ans('t', 'b', 3, { choice: 1 }), ans('x', 'c', 3, { choice: 0 })], S, SIDES, {});
    expect(r).toEqual({ kind: 'choice', counts: [0, 2, 0, 0], correct: 1 });
  });

  it('holds words until a leader approves them', () => {
    const c = act('c', 'cloud');
    const rows = [ans('c', 'a', 1, { word: 'Tired!' }), ans('c', 'b', 2, { word: 'tired' }), ans('c', 'd', 3, { word: 'rude' })];
    expect(tally(c, rows, S, SIDES, {})).toEqual({ kind: 'cloud', words: [] });
    expect(pendingWords(rows, 'c', {})).toEqual([
      ['tired', 2],
      ['rude', 1]
    ]);
    expect(tally(c, rows, S, SIDES, { tired: true, rude: false })).toEqual({ kind: 'cloud', words: [['tired', 2]] });
    expect(tally(c, rows, { ...S, approve: 'off' }, SIDES, { rude: false })).toEqual({ kind: 'cloud', words: [['tired', 2]] });
  });

  it('scores right answers higher the faster they come', () => {
    const t = act('t', 'trivia');
    expect(pointsFor(t, ans('t', 'a', 1000, { choice: 1 }), 0, S)).toBe(975);
    expect(pointsFor(t, ans('t', 'a', 20000, { choice: 1 }), 0, S)).toBe(500);
    expect(pointsFor(t, ans('t', 'a', 1000, { choice: 0 }), 0, S)).toBe(0);
    const v = act('v', 'verse');
    expect(pointsFor(v, ans('v', 'a', 0, { blanks: ['Courageous', 'nowhere'] }), 0, S)).toBe(500);
  });

  it('ranks the room by points, names as the night says', () => {
    const t = act('t', 'trivia');
    const rows = [ans('t', 'a', 5000, { choice: 1 }), ans('t', 'b', 1000, { choice: 1 }), ans('t', 'c', 1000, { choice: 2 })];
    expect(leaderboard([t], rows, { t: 0 }, S).map((r) => r.name)).toEqual(['b!', 'a!', 'c!']);
    expect(leaderboard([t], rows, { t: 0 }, { ...S, names: 'first' })[0].name).toBe('B');
    expect(leaderboard([t], rows, {}, S)).toEqual([]);
    expect(leaderboard([t], rows, { t: 0 }, { ...S, points: 'off' })).toEqual([]);
  });

  it('adds up tug-of-war taps by side and says who won', () => {
    const g = act('g', 'tug');
    const r = tally(g, [ans('g', 'a', 1, { taps: 30 }, 0), ans('g', 'b', 1, { taps: 10 }, 1), ans('g', 'c', 1, { taps: 20 }, 1)], S, SIDES, {});
    expect(r).toEqual({ kind: 'tug', sides: SIDES, taps: [30, 30] });
    expect(summaryLine(g, { kind: 'tug', sides: SIDES, taps: [60, 40] })).toBe('Red won, 60% to 40%');
  });

  it('splits sides by squad, by grade, or by a stable coin flip', () => {
    expect(sidesFor('squads', [{ id: 'a', name: 'Lions' }, { id: 'b', name: 'Bears' }, { id: 'c', name: 'Owls' }], [])).toEqual(['Lions & Owls', 'Bears']);
    expect(sidesFor('grade', [], ['6th', '7th', '8th'])).toEqual(['6th–7th grade', '8th grade']);
    expect(sideFor('squads', { member: 'm', team: 'b', grade: '7th' }, ['a', 'b'], [])).toBe(1);
    expect(sideFor('grade', { member: 'm', team: null, grade: '8th' }, [], ['6th', '7th', '8th'])).toBe(1);
    const flip = sideFor('auto', { member: 'xyz', team: null, grade: '' }, [], []);
    expect(sideFor('auto', { member: 'xyz', team: 'a', grade: '6th' }, ['a'], ['6th'])).toBe(flip);
  });

  it('writes a debrief line for each kind', () => {
    const t = act('t', 'trivia');
    expect(summaryLine(t, { kind: 'choice', counts: [1, 3, 0, 0], correct: 1 })).toBe('75% chose Joshua · 4 answered');
    expect(summaryLine(act('h', 'this'), { kind: 'choice', counts: [1, 3], correct: null })).toBe('Family 75% · 4 answered');
    expect(summaryLine(act('c', 'cloud'), { kind: 'cloud', words: [['tired', 3], ['fun', 1]] })).toBe('Top words: tired, fun · 2 approved');
    expect(summaryLine(act('v', 'verse'), { kind: 'verse', blanks: [{ answer: 'courageous', right: 3 }], total: 4 })).toBe('“courageous” 75% right · 4 answered');
  });

  it('only lets the demo room answer what has arrived by now', () => {
    const t = act('t1', 'trivia');
    const names = Array.from({ length: 30 }, (_, i) => 'Kid' + i + ' Last');
    const early = simulatedAnswers(t, 0, null, 1000, names, S);
    const later = simulatedAnswers(t, 0, null, 60_000, names, S);
    expect(early.length).toBe(0);
    expect(later.length).toBe(24);
    expect(later.every((a) => !a.name.includes('Last'))).toBe(true);
    expect(simulatedAnswers(t, 0, 5000, 60_000, names, S).length).toBeLessThan(24);
  });
});
