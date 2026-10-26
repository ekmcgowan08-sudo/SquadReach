import { beforeEach, describe, expect, it } from 'vitest';
import { clearRecents, isDeep, noteVisit, readRecents, withVisit } from '@/lib/recents';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k)
  } as Storage;
});

describe('recent screens', () => {
  it('only counts deep screens, not the tabs', () => {
    expect(['/dashboard', '/dashboard/more', '/dashboard/chat', '/dashboard/score', '/dashboard/bible'].some(isDeep)).toBe(false);
    expect(isDeep('/dashboard/library')).toBe(true);
    expect(isDeep('/planner')).toBe(false);
  });

  it('keeps the newest first, without repeats, up to six', () => {
    let items: string[] = [];
    for (const p of ['/a', '/b', '/c', '/a', '/d', '/e', '/f', '/g']) items = withVisit(items, p);
    expect(items).toEqual(['/g', '/f', '/e', '/d', '/a', '/c']);
  });

  it('belongs to one person in one role; another reads none, and clearing empties it', () => {
    noteVisit('leader:m1', '/dashboard/library');
    noteVisit('leader:m1', '/dashboard/calendar');
    noteVisit('leader:m1', '/dashboard/more');
    expect(readRecents('leader:m1')).toEqual(['/dashboard/calendar', '/dashboard/library']);
    expect(readRecents('coach:m1')).toEqual([]);
    noteVisit('coach:m1', '/dashboard/attendance');
    expect(readRecents('leader:m1')).toEqual([]);
    clearRecents();
    expect(readRecents('coach:m1')).toEqual([]);
  });
});
