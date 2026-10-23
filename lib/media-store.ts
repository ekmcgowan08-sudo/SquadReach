'use client';
/* Files taken on this phone — album photos and filmed clips — kept in their
   own IndexedDB store, separate from the held-work outbox. A clip is only
   ever here until someone saves or shares it. */
import { createStore, del, get, set } from 'idb-keyval';
import { useEffect, useState } from 'react';

let store: ReturnType<typeof createStore> | null = null;
const blobs = () => (store ??= createStore('squadrise-media', 'blobs'));

export const putBlob = (key: string, blob: Blob) => set(key, blob, blobs());
export const getBlob = (key: string) => get<Blob>(key, blobs());
export const delBlob = (key: string) => del(key, blobs());

/** An object URL for a blob on this phone, else a signed URL for `path`. */
export function useFileUrl(localKey: string | null | undefined, path: string | null | undefined, remote: (path: string) => Promise<string | null>): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    (async () => {
      if (localKey) {
        const b = await getBlob(localKey).catch(() => undefined);
        if (b && alive) {
          made = URL.createObjectURL(b);
          setUrl(made);
          return;
        }
      }
      if (path) {
        const r = await remote(path).catch(() => null);
        if (alive) setUrl(r);
      }
    })();
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `remote` is the backend's method; the keys are what change
  }, [localKey, path]);
  return url;
}
