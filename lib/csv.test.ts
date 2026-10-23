import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '@/lib/csv';
import { parseRoster } from '@/lib/roster';

describe('csv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
  });
  it('defuses formulas but leaves negative numbers alone', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell('-400')).toBe('-400');
    expect(csvCell('@sum')).toBe("'@sum");
  });
  it('builds rows with CRLF', () => {
    expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('a,b\r\n1,x\r\n');
  });
});

describe('roster import', () => {
  const teams = [
    { id: 'y', name: 'Yellow' },
    { id: 'r', name: 'Red' }
  ];
  it('reads name, grade, squad from commas or tabs and skips a header', () => {
    const { rows, skipped } = parseRoster('Name,Grade,Squad\nEllison Reid, 8, Yellow\nIsaac Smith\t9th\tred\n\nX', teams);
    expect(rows.map((r) => [r.name, r.grade, r.team])).toEqual([
      ['Ellison Reid', '8', 'y'],
      ['Isaac Smith', '9th', 'r']
    ]);
    expect(skipped).toEqual(['X']);
  });
  it('leaves an unknown squad unassigned', () => {
    expect(parseRoster('Ava Lin, 10, Purple', teams).rows[0].team).toBeNull();
  });
});
