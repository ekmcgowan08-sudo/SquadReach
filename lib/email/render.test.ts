import { describe, expect, it } from 'vitest';
import { MAX_ROWS, renderReport } from '@/lib/email/render';
import { inZone, zoneOffset } from '@/lib/time-zone';

const result = (n: number) => ({
  columns: [
    { id: 'name', label: 'Name', kind: 'text' as const },
    { id: 'points', label: 'Points', kind: 'num' as const }
  ],
  rows: Array.from({ length: n }, (_, i) => ({ name: i === 0 ? '<script>alert(1)</script> & Co' : 'Kid ' + i, points: i })),
  matched: n
});

describe('report email', () => {
  it('escapes everything from the ministry’s data', () => {
    const e = renderReport({ ministry: 'Grace <Students>', report: 'Roster', copy: 'Yellow', when: 'Sunday', result: result(2), appUrl: 'https://x.test/console?tab=reports', to: 'coach@example.org' });
    expect(e.html).not.toContain('<script>');
    expect(e.html).toContain('&lt;script&gt;');
    expect(e.html).toContain('Grace &lt;Students&gt;');
    expect(e.subject).toBe('Roster · Yellow · Grace <Students>');
    expect(e.text).toContain('Kid 1 | 1');
  });

  it('caps long reports and says how many more', () => {
    const e = renderReport({ ministry: 'M', report: 'R', copy: 'Whole ministry', when: 'w', result: result(MAX_ROWS + 5), appUrl: 'u', to: 't' });
    expect(e.html).toContain('And 5 more');
    expect(e.subject).toBe('R · M');
  });
});

describe('ministry time zone', () => {
  it('knows the offset either side of daylight saving', () => {
    expect(zoneOffset('America/Chicago', Date.UTC(2026, 0, 15, 12))).toBe(-360);
    expect(zoneOffset('America/Chicago', Date.UTC(2026, 6, 15, 12))).toBe(-300);
    expect(zoneOffset('Asia/Manila', Date.UTC(2026, 6, 15, 12))).toBe(480);
  });

  it('shifts a moment so local getters read the ministry’s wall clock', () => {
    const at = Date.UTC(2026, 9, 25, 13, 30); // 8:30 in Chicago (CDT)
    const d = new Date(inZone(at, 'America/Chicago'));
    expect([d.getHours(), d.getMinutes(), d.getDate()]).toEqual([8, 30, 25]);
  });
});
