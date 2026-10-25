import { describe, expect, it } from 'vitest';
import type { DocKey } from '@/lib/data/backend';
import { docSync } from '@/lib/data/doc-sync';

type Item = { id: string; title: string };

/* save_doc's rules, in memory: write only over the revision you saw. */
function server(initial: Item[]) {
  const s = { rev: 1, value: initial as unknown, writes: 0 };
  const listeners: ((rev: number, value: unknown) => void)[] = [];
  return {
    s,
    listen: (f: (rev: number, value: unknown) => void) => listeners.push(f),
    save: async (_key: DocKey, value: unknown, rev: number) => {
      await Promise.resolve();
      if (rev !== s.rev) return { ok: false, rev: s.rev, value: s.value };
      s.rev++;
      s.value = structuredClone(value);
      s.writes++;
      /* Realtime can beat the reply: tell everyone first. */
      const at = s.rev;
      listeners.forEach((f) => f(at, structuredClone(s.value)));
      await Promise.resolve();
      return { ok: true, rev: at };
    }
  };
}

/* A leader's phone: a local copy, synced through docSync. */
function leader(srv: ReturnType<typeof server>) {
  let local: unknown = structuredClone(srv.s.value);
  const sync = docSync(srv.save);
  sync.seed('plan', srv.s.rev, structuredClone(srv.s.value));
  sync.bind({ read: () => local, write: (_k, v) => void (local = v) });
  srv.listen((rev, value) => sync.absorb('plan', rev, value));
  /* Like the backend: one save at a time, each reading the newest copy. */
  let queue: Promise<unknown> = Promise.resolve();
  return {
    get: () => local as Item[],
    edit: (f: (l: Item[]) => Item[]) => {
      local = f(structuredClone(local as Item[]));
      const run = queue.then(() => sync.save('plan', local));
      queue = run.catch(() => undefined);
      return run;
    }
  };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('saving a document two leaders edit', () => {
  it('keeps both leaders’ edits when they save at the same moment', async () => {
    const srv = server([{ id: 'a', title: 'Acts' }]);
    const one = leader(srv);
    const two = leader(srv);
    await Promise.all([one.edit((l) => [...l, { id: 'b', title: 'From one' }]), two.edit((l) => [...l, { id: 'c', title: 'From two' }])]);
    await settle();
    const ids = (srv.s.value as Item[]).map((x) => x.id).sort();
    expect(ids).toEqual(['a', 'b', 'c']);
    expect(one.get().map((x) => x.id).sort()).toEqual(['a', 'b', 'c']);
    expect(two.get().map((x) => x.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('never resurrects something deleted while a save was in flight', async () => {
    const srv = server([{ id: 'a', title: 'Acts' }]);
    const one = leader(srv);
    const two = leader(srv);
    const first = one.edit((l) => [...l, { id: 'tmp', title: 'Oops' }]);
    const second = one.edit((l) => l.filter((x) => x.id !== 'tmp'));
    await two.edit((l) => l.map((x) => ({ ...x, title: 'Acts: The Church' })));
    await Promise.all([first, second]);
    await settle();
    expect(srv.s.value).toEqual([{ id: 'a', title: 'Acts: The Church' }]);
    expect(one.get()).toEqual([{ id: 'a', title: 'Acts: The Church' }]);
  });

  it('folds another leader’s save into unsaved local edits', async () => {
    const srv = server([{ id: 'a', title: 'Acts' }]);
    const one = leader(srv);
    const two = leader(srv);
    await two.edit((l) => [...l, { id: 'z', title: 'Theirs' }]);
    await settle();
    expect(one.get().map((x) => x.id)).toEqual(['a', 'z']);
    await one.edit((l) => l.map((x) => (x.id === 'a' ? { ...x, title: 'Mine' } : x)));
    await settle();
    expect(srv.s.value).toEqual([{ id: 'a', title: 'Mine' }, { id: 'z', title: 'Theirs' }]);
  });

  it('does not write when nothing changed', async () => {
    const srv = server([{ id: 'a', title: 'Acts' }]);
    const one = leader(srv);
    await one.edit((l) => l);
    expect(srv.s.writes).toBe(0);
  });
});
