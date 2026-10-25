/* Saving ministry documents that several leaders edit (Supabase mode).

   The client remembers the revision and value it last knew the server to
   hold. A save always sends the newest local copy over that revision; if
   someone else saved first, the server says so and hands back its copy,
   which is merged into ours (lib/merge3.ts) before going again. Saves of
   one document go one at a time (the backend's queue). Other
   leaders' saves that arrive over realtime are merged the same way, so
   unsaved local edits survive them. */
import type { DocIO, DocKey } from '@/lib/data/backend';
import { merge3, same } from '@/lib/merge3';

export type SaveDoc = (key: DocKey, value: unknown, rev: number) => Promise<{ ok: boolean; rev: number; value?: unknown }>;

export function docSync(save: SaveDoc) {
  const known = new Map<string, { rev: number; value: unknown }>();
  /** A save on its way: our own copy coming back over realtime is not news. */
  const sending = new Map<string, unknown>();
  let io: DocIO | null = null;

  /** Someone saved a document: fold their version into ours. */
  const absorb = (key: DocKey, rev: number, theirs: unknown) => {
    const k = known.get(key) ?? { rev: 0, value: undefined };
    if (rev <= k.rev) return;
    known.set(key, { rev, value: theirs });
    if (sending.has(key) && same(theirs, sending.get(key))) return;
    if (io) io.write(key, merge3(k.value, io.read(key), theirs));
  };

  return {
    bind(next: DocIO) {
      io = next;
    },
    /** What the load found. */
    seed(key: DocKey, rev: number, value: unknown) {
      known.set(key, { rev, value });
    },
    absorb,
    async save(key: DocKey, sent: unknown) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const k = known.get(key) ?? { rev: 0, value: undefined };
        const mine = io ? io.read(key) : sent;
        if (same(mine, k.value)) return;
        sending.set(key, mine);
        const res = await save(key, mine, k.rev).finally(() => sending.delete(key));
        if (res.ok) {
          if ((known.get(key)?.rev ?? 0) < res.rev) known.set(key, { rev: res.rev, value: mine });
          return;
        }
        absorb(key, res.rev, res.value);
      }
      throw new Error('Could not save ' + key + ': it kept changing underneath.');
    }
  };
}
