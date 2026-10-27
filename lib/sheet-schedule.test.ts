import { describe, expect, it } from 'vitest';
import { demoMinistry } from '@/lib/data/seed';
import { publishSheet, scheduleAt, scheduleDue, scheduleSentence } from '@/lib/sheet-schedule';

describe('publishing the run sheet on a schedule', () => {
  const s = { daysBefore: 1, time: '16:00' };
  it('goes out the chosen days before the night, at the chosen time', () => {
    expect(scheduleAt(s, '2026-10-28')).toBe('2026-10-27T16:00');
    expect(scheduleAt({ daysBefore: 0, time: '09:30' }, '2026-10-28')).toBe('2026-10-28T09:30');
    expect(scheduleSentence(s, '2026-10-28')).toBe('Goes out Tuesday, the day before, at 4:00 PM');
  });
  it('is due on the ministry’s own clock', () => {
    const chicago = 'America/Chicago';
    expect(scheduleDue(s, '2026-10-28', Date.UTC(2026, 9, 27, 20, 59), chicago)).toBe(false);
    expect(scheduleDue(s, '2026-10-28', Date.UTC(2026, 9, 27, 21, 0), chicago)).toBe(true);
    expect(scheduleDue(null, '2026-10-28', Date.now())).toBe(false);
  });
  it('tells every owner not yet told, and spends the schedule', () => {
    const h = { ...demoMinistry().huddle, sheetSchedule: s, sheetDirty: true };
    h.runSheet = h.runSheet.map((it, i) => (i === 0 ? { ...it, assignedTo: h.crew[0].id, notifiedAt: null } : it));
    const { huddle, told } = publishSheet(h, 1000);
    expect(told).toContain(h.crew[0].name);
    expect(huddle.runSheet[0].notifiedAt).toBe(1000);
    expect(huddle.sheetSchedule).toBeNull();
    expect(huddle.sheetDirty).toBe(false);
  });
});
