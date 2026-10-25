import { describe, expect, it } from 'vitest';
import { merge3, same } from '@/lib/merge3';
import { demoPlan } from '@/lib/data/seed-plan';

const clone = <T,>(x: T): T => structuredClone(x);

describe('three-way merge', () => {
  it('takes whichever side changed a value', () => {
    expect(merge3({ a: 1, b: 1 }, { a: 2, b: 1 }, { a: 1, b: 3 })).toEqual({ a: 2, b: 3 });
  });

  it('lets mine win when both changed the same value', () => {
    expect(merge3({ a: 1 }, { a: 2 }, { a: 3 })).toEqual({ a: 2 });
  });

  it('keeps additions from both sides, by id, in a sensible order', () => {
    const base = [{ id: 'a' }, { id: 'b' }];
    const mine = [{ id: 'a' }, { id: 'm' }, { id: 'b' }];
    const theirs = [{ id: 'a' }, { id: 'b' }, { id: 't' }];
    expect(merge3(base, mine, theirs).map((x) => x.id)).toEqual(['a', 'm', 'b', 't']);
  });

  it('removes what one side removed, unless the other side edited it', () => {
    const base = [{ id: 'a', n: 1 }, { id: 'b', n: 1 }];
    expect(merge3(base, [{ id: 'b', n: 1 }], base)).toEqual([{ id: 'b', n: 1 }]);
    expect(merge3(base, [{ id: 'b', n: 1 }], [{ id: 'a', n: 2 }, { id: 'b', n: 1 }])).toEqual([{ id: 'a', n: 2 }, { id: 'b', n: 1 }]);
  });

  it('merges edits to different fields of the same element', () => {
    const base = [{ id: 'a', title: 'Acts', size: 6 }];
    expect(merge3(base, [{ id: 'a', title: 'Acts: The Church', size: 6 }], [{ id: 'a', title: 'Acts', size: 8 }])).toEqual([{ id: 'a', title: 'Acts: The Church', size: 8 }]);
  });

  it('treats arrays without ids as sets', () => {
    expect(merge3(['x', 'y'], ['x', 'y', 'z'], ['y'])).toEqual(['y', 'z']);
  });

  it('keeps their edit to something I deleted from an object', () => {
    expect(merge3({ k: { a: 1 } }, {}, { k: { a: 2 } })).toEqual({ k: { a: 2 } });
    expect(merge3({ k: { a: 1 } }, {}, { k: { a: 1 } })).toEqual({});
  });

  it('merges two leaders’ edits to the real plan without losing either', () => {
    const base = demoPlan(Date.UTC(2026, 9, 23));
    const mine = clone(base);
    const theirs = clone(base);
    mine.items.find((i) => i.id === 'pi1')!.title = 'Alive: Ephesians (revised)';
    mine.items.push({ id: 'new-m', lane: 'events', year: 1, title: 'Mine', kind: 'event', size: 1, status: 'draft', notes: '', tags: [] });
    theirs.items.find((i) => i.id === 'pi1')!.size = 10;
    theirs.items = theirs.items.filter((i) => i.id !== 'pi2');
    theirs.gatherings['2026-10-28'] = { ...theirs.gatherings['2026-10-28'], brief: 'Changed by them' };
    mine.settings.translation = 'ESV';
    const out = merge3(base, mine, theirs);
    const pi1 = out.items.find((i) => i.id === 'pi1')!;
    expect(pi1.title).toBe('Alive: Ephesians (revised)');
    expect(pi1.size).toBe(10);
    expect(out.items.some((i) => i.id === 'pi2')).toBe(false);
    expect(out.items.some((i) => i.id === 'new-m')).toBe(true);
    expect(out.gatherings['2026-10-28'].brief).toBe('Changed by them');
    expect(out.gatherings['2026-10-28'].live?.acts.length).toBe(5);
    expect(out.settings.translation).toBe('ESV');
    expect(merge3(base, base, base)).toBe(base);
  });

  it('undoes one step without undoing someone else’s', () => {
    // undo = merge3(after, before, now): revert only what that step changed
    const before = { a: 1, b: 1 };
    const after = { a: 2, b: 1 };
    const now = { a: 2, b: 5 }; // someone else changed b since
    expect(merge3(after, before, now)).toEqual({ a: 1, b: 5 });
  });

  it('compares deeply, ignoring undefined keys', () => {
    expect(same({ a: [1, { b: 2 }], c: undefined }, { a: [1, { b: 2 }] })).toBe(true);
    expect(same({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
  });
});
