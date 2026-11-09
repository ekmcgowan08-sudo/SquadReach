import { describe, expect, it } from 'vitest';
import { gameNightEvent, nextGameNight, nightEntry } from '@/lib/game-night';
import type { GameSetup, MinistryEvent, RunSheetItem } from '@/lib/types/model';

const setup = (over: Partial<GameSetup> = {}): GameSetup => ({ rulesText: '', rulesVideoUrl: '', fieldTypes: [], offsiteAddress: '', markupDataUrl: null, gameWeeks: null, ...over });
const nights = ['2026-11-04', '2026-11-11', '2026-11-18', '2026-11-25'];
const row = (id: string, time: string, label: string, where: string): RunSheetItem => ({ id, time, label, where, who: '', detail: '', assignedTo: null, notifiedAt: null });
const sheet = [row('a', '6:15pm', 'Huddle', 'Room 204'), row('b', '6:45pm', 'Doors', 'Lobby'), row('c', '7:45pm', 'Games', 'Main gym')];
const wk2 = { iso: '2026-11-11', week: 2 };

describe('game night on the calendar', () => {
  it('is the next meeting night that has a game', () => {
    expect(nextGameNight({ meetingDates: nights, gameSetup: setup() }, '2026-11-09')).toEqual(wk2);
    expect(nextGameNight({ meetingDates: nights, gameSetup: setup() }, '2026-11-11')).toEqual(wk2);
    expect(nextGameNight({ meetingDates: nights, gameSetup: setup({ gameWeeks: [1, 4] }) }, '2026-11-09')).toEqual({ iso: '2026-11-25', week: 4 });
    expect(nextGameNight({ meetingDates: nights, gameSetup: setup({ gameWeeks: [] }) }, '2026-11-01')).toBeNull();
    expect(nextGameNight({ meetingDates: nights, gameSetup: setup() }, '2026-11-26')).toBeNull();
  });
  it('is named for the week and the game, at doors, where the game is, for everyone', () => {
    const e = gameNightEvent({ gameName: 'Pipeline relay', gameSetup: setup({ fieldTypes: ['Gym Court', 'Parking lot'] }) }, sheet, wk2, 'id1', 'Pastor Mike · leader');
    expect(e).toMatchObject({ id: 'id1', title: 'Week 2 · Pipeline relay', date: 'Nov 11', iso: '2026-11-11', time: '6:45pm', place: 'Gym Court + Parking lot', status: 'approved', meta: 'Wed 6:45pm · Gym Court + Parking lot' });
    expect(e.roles).toEqual(expect.arrayContaining(['parents', 'members', 'coaches']));
    expect(gameNightEvent({ gameName: '', gameSetup: setup({ offsiteAddress: ' 12 Elm St ', fieldTypes: ['Offsite'] }) }, [], wk2, 'x', 'b')).toMatchObject({ title: 'Week 2 · Game night', time: '', place: '12 Elm St', meta: 'Wed · 12 Elm St' });
    expect(gameNightEvent({ gameName: 'Relay', gameSetup: setup() }, [sheet[2]], wk2, 'x', 'b')).toMatchObject({ time: '7:45pm', place: 'Main gym' });
  });
  it('finds the night’s own entry when the week is already on the calendar', () => {
    const ev = (over: Partial<MinistryEvent>): MinistryEvent => ({ id: 'e', title: 'Week 2 · Pipeline relay', meta: '', date: 'Nov 11', iso: '2026-11-11', color: '#000', roles: [], ...over });
    expect(nightEntry([ev({ id: 'other', title: 'Coaches’ lunch' }), ev({ id: 'night' })], wk2)?.id).toBe('night');
    expect(nightEntry([ev({ status: 'proposed' })], wk2)).toBeUndefined();
    expect(nightEntry([ev({ iso: '2026-11-18' })], wk2)).toBeUndefined();
    expect(nightEntry([ev({ title: 'Week 12 · Something' })], wk2)).toBeUndefined();
  });
});
