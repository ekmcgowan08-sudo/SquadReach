import { describe, expect, it } from 'vitest';
import { demoMinistry } from '@/lib/data/seed';
import {
  ENSEMBLE_BONUS, PROOF_BONUS, STUDENT_ITEMS, emptySheet, pointBase, sheetTotal, standingGaps, standings,
  studentItemValue, teamTotal, type SheetState
} from '@/lib/scoring';
import type { LedgerEntry } from '@/lib/types/model';

const ctx = { base: 1476, versePts: 20, verseBoard: 25 };
const item = (id: string) => STUDENT_ITEMS.find((i) => i.id === id)!;
const sheet = (patch: Partial<SheetState>): SheetState => ({ ...emptySheet(), ...patch });

describe('point base', () => {
  it('grows each week — week 9 of a 900 base at 8% is 1,476', () => {
    expect(pointBase({ pointBase: 900, weekGrowthPct: 8, weekNumber: 9 })).toBe(1476);
    expect(pointBase({ pointBase: 900, weekGrowthPct: 8, weekNumber: 1 })).toBe(900);
  });
});

describe('ledger totals', () => {
  const d = demoMinistry(0);
  it('the demo ledger sums to exactly the board the design shows', () => {
    expect(teamTotal(d.ledger, 'yellow')).toBe(8145);
    expect(teamTotal(d.ledger, 'red')).toBe(2900);
    expect(teamTotal(d.ledger, 'blue')).toBe(1710);
    expect(teamTotal(d.ledger, 'green')).toBe(80);
  });
  it('a pending row is a request, not a score', () => {
    const pending = d.ledger.filter((e) => e.status === 'pending');
    expect(pending.length).toBe(2);
    const withApproved: LedgerEntry[] = d.ledger.map((e) => (e.status === 'pending' ? { ...e, status: 'approved' } : e));
    expect(teamTotal(withApproved, 'blue')).toBe(1710 + 800);
  });
  it('standings rank by total and report the gaps', () => {
    const rows = standings(d.teams, d.cats, d.ledger);
    expect(rows.map((r) => r.id)).toEqual(['yellow', 'red', 'blue', 'green']);
    expect(standingGaps(rows)).toEqual([
      { label: '1st to 4th', value: '8,065' },
      { label: '1st to 3rd', value: '6,435' },
      { label: '2nd to 4th', value: '2,820' }
    ]);
    expect(rows[1].behind).toBe(5245);
  });
});

describe('studentItemValue — the only place a row is valued', () => {
  it('an unpicked row is worth nothing', () => {
    expect(studentItemValue(item('bible'), emptySheet(), ctx)).toBe(0);
  });
  it('friends pay base × mult × count', () => {
    const it = item('friend_new_1');
    expect(studentItemValue(it, sheet({ picks: { [it.id]: true }, counts: { [it.id]: 3 } }), ctx)).toBe(1476 * 2 * 3);
  });
  it('articles are cumulative and five earns the ensemble bonus', () => {
    const it = item('team_color');
    expect(studentItemValue(it, sheet({ picks: { [it.id]: true }, articles: 4 }), ctx)).toBe(120);
    expect(studentItemValue(it, sheet({ picks: { [it.id]: true }, articles: 5 }), ctx)).toBe(150 + ENSEMBLE_BONUS);
  });
  it('verses use the pastor’s weekly value and cap at the board size', () => {
    const it = item('week_verse');
    expect(studentItemValue(it, sheet({ picks: { [it.id]: true }, verses: { [it.id]: 6 } }), ctx)).toBe(120);
    expect(studentItemValue(it, sheet({ picks: { [it.id]: true }, verses: { [it.id]: 99 } }), { ...ctx, verseBoard: 10 })).toBe(200);
  });
  it('proof is never a gate — it only adds the bonus', () => {
    const it = item('church_vol');
    expect(studentItemValue(it, sheet({ picks: { [it.id]: true } }), ctx)).toBe(50);
    expect(studentItemValue(it, sheet({ picks: { [it.id]: true }, proof: { [it.id]: true } }), ctx)).toBe(50 + PROOF_BONUS);
  });
  it('the sheet total is the sum of its rows', () => {
    const s = sheet({ picks: { bible: true, sl_shirt: true } });
    expect(sheetTotal(s, ctx)).toBe(80);
  });
});

describe('a category’s own base', () => {
  const c = { pointBase: 900, weekGrowthPct: 8, weekNumber: 9, catCfg: { visitors: { base: 1200, growth: null }, games: { base: null, growth: 0 } } };
  it('starts from its own base and grows at its own rate, following the season for what it leaves empty', () => {
    expect(pointBase(c)).toBe(1476);
    expect(pointBase(c, 'general')).toBe(1476);
    expect(pointBase(c, 'visitors')).toBe(1968);
    expect(pointBase(c, 'games')).toBe(900);
    expect(pointBase(c, 'visitors', 1)).toBe(1200);
  });
});
