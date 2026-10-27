import { describe, expect, it } from 'vitest';
import { atLocal } from '@/lib/cycle';
import { demoMinistry } from '@/lib/data/seed';
import { REPORT_PRESETS, REPORT_SOURCES, deliveriesDueToday, deliveryDue, deliveryRecipientGroups, deliverySent, runReport, scopedSpec, sourceRows } from '@/lib/report-builder';

const d = demoMinistry(atLocal('2026-10-23', '12:00'));

describe('the report builder', () => {
  it('declares fields every source actually returns', () => {
    for (const s of REPORT_SOURCES) {
      const rows = sourceRows(d, s.id);
      if (!rows.length) continue;
      for (const f of s.fields) expect(Object.keys(rows[0]), s.id + '.' + f.id).toContain(f.id);
    }
  });

  it('filters numbers as numbers and text as text', () => {
    const r = runReport(d, { source: 'squads', columns: ['squad', 'total'], filters: [{ field: 'total', op: 'gt', value: '1000' }], groupBy: null, sort: { field: 'total', dir: 'desc' } });
    expect(r.rows.every((x) => Number(x.total) > 1000)).toBe(true);
    expect(r.rows.map((x) => Number(x.total))).toEqual([...r.rows.map((x) => Number(x.total))].sort((a, b) => b - a));
    const yellow = runReport(d, { source: 'students', columns: ['name', 'squad'], filters: [{ field: 'squad', op: 'is', value: 'yellow' }], groupBy: null, sort: null });
    expect(yellow.rows.length).toBe(d.roster.filter((s) => s.team === 'yellow').length);
  });

  it('groups with sums and a row count', () => {
    const r = runReport(d, { source: 'ledger', columns: ['squad', 'amount'], filters: [{ field: 'status', op: 'is', value: 'approved' }], groupBy: 'squad', sort: { field: 'amount', dir: 'desc' } });
    expect(r.columns.map((c) => c.id)).toEqual(['squad', 'amount', 'rows']);
    expect(r.rows).toHaveLength(d.teams.length);
    expect(r.rows.reduce((n, x) => n + Number(x.rows), 0)).toBe(r.matched);
  });

  it('drops any column the source does not declare — the allow-list', () => {
    const r = runReport(d, { source: 'students', columns: ['name', 'notes', 'contact'], filters: [{ field: 'secret', op: 'is', value: 'x' }], groupBy: 'contact', sort: null });
    expect(r.columns.map((c) => c.id)).toEqual(['name']);
    expect(r.rows.length).toBe(d.roster.length);
    expect(Object.keys(r.rows[0])).not.toContain('contact');
  });

  it('runs every preset', () => {
    for (const p of REPORT_PRESETS) expect(() => runReport(d, p)).not.toThrow();
  });
});

describe('deliveries', () => {
  const roster = d.deliveries.find((x) => x.id === 'dl1')!;

  it('send each squad its own copy, to whoever coaches and captains it now', () => {
    const groups = deliveryRecipientGroups(d, roster);
    expect(groups).toHaveLength(d.teams.length);
    const yellow = groups.find((g) => g.team === 'yellow')!;
    expect(yellow.names).toContain('Chris Alder');
    expect(yellow.names.some((n) => n.includes('(captain)'))).toBe(true);
    expect(yellow.names).not.toContain('Marcus Hall');
  });

  it('narrow a squad copy to that squad', () => {
    const spec = scopedSpec({ source: 'students', columns: ['name'], filters: [], groupBy: null, sort: null }, 'Yellow');
    expect(runReport(d, spec).rows.length).toBe(d.roster.filter((s) => s.team === 'yellow').length);
  });

  it('are due on their day and sent once their time passes', () => {
    const thu = atLocal('2026-10-29', '08:00');
    expect(deliveriesDueToday(d, thu).map((x) => x.id)).toContain('dl1');
    expect(deliverySent(d, roster, thu)).toBe(false);
    expect(deliverySent(d, roster, atLocal('2026-10-29', '09:30'))).toBe(true);
    expect(deliveryDue(d, roster, thu)!.period).toBe('w:2026-10-29');
    const off = { ...roster, on: false };
    expect(deliverySent(d, off, atLocal('2026-10-29', '09:30'))).toBe(false);
  });
});

describe('a delivery that goes when the night closes', () => {
  it('is due the moment the night closes, once for that night', () => {
    const d = demoMinistry();
    const dl = { id: 'c1', report: 'standings', audience: 'leaders' as const, scope: 'all' as const, cadence: 'close' as const, day: 0, time: '21:00', on: true };
    d.deliveries = [dl];
    d.huddle.nightClosed = false;
    expect(deliveryDue(d, dl, Date.now())).toBeNull();
    expect(deliverySent(d, dl, Date.now())).toBe(false);
    d.huddle.nightClosed = true;
    d.huddle.closedAt = 1_000;
    expect(deliveryDue(d, dl, 2_000)).toEqual({ at: 1_000, period: 'c:' + d.tonight.date });
    expect(deliverySent(d, dl, 2_000)).toBe(true);
    expect(deliveriesDueToday(d, 500).some((x) => x.id === 'c1')).toBe(false);
  });
});
