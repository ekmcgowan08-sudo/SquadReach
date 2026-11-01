'use client';
/* Small-group guides saved on this phone, for rooms with no signal. A saved
   copy is self-contained — each screen carries its own look, and a picture
   from the bank its colour and name — so public/offline.html, the page the
   service worker shows when the app can't load, plays it with nothing but
   this IndexedDB store. The app keeps saved copies current while it's open. */
import { createStore, del, entries, set } from 'idb-keyval';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { pictureOf } from '@/lib/small-group-ideas';
import { sgMinutes, sgType } from '@/lib/small-groups';
import type { SmallGroup, SmallGroupScreen } from '@/lib/types/model';

/** What a screen looks like, resolved so the offline page needs no app code. */
export interface ScreenLook {
  label: string;
  color: string;
  bg: string;
}

export interface SavedScreen extends SmallGroupScreen {
  look: ScreenLook;
  /** A bank picture, as the offline page draws it: a coloured tile with its name. */
  tile?: { label: string; color: string } | null;
}

export interface SavedGuide {
  /** org:guide — one phone can hold guides from more than one ministry. */
  key: string;
  org: string;
  ministry: string;
  id: string;
  title: string;
  notes: string;
  weekNumber: number;
  minutes: number;
  savedAt: number;
  screens: SavedScreen[];
}

/* The offline page opens these names directly; change them together. */
export const OFFLINE_DB = 'squadrise-offline';
export const OFFLINE_STORE = 'guides';

let store: ReturnType<typeof createStore> | null = null;
const guides = () => (store ??= createStore(OFFLINE_DB, OFFLINE_STORE));

export const guideKey = (org: string, id: string) => org + ':' + id;

/** The copy that goes on the phone. Pure, so it's tested without a browser. */
export function offlineCopy(g: SmallGroup, org: string, ministry: string, now: number): SavedGuide {
  return {
    key: guideKey(org, g.id),
    org,
    ministry,
    id: g.id,
    title: g.title,
    notes: g.notes,
    weekNumber: g.weekNumber,
    minutes: sgMinutes(g.screens),
    savedAt: now,
    screens: g.screens.map((sc) => {
      const bank = sc.image && !sc.image.src ? pictureOf(sc.image.bankId) : null;
      const t = sgType(sc.type);
      return { ...sc, look: { label: t.label, color: t.color, bg: t.bg }, tile: bank ? { label: bank.label, color: bank.color } : null };
    })
  };
}

/* Which guides this phone holds, by key — kept in memory once read, so a
   list of guides can show "Saved offline" without waiting each render. */
let saved: Set<string> | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

async function readKeys(): Promise<Set<string>> {
  if (saved) return saved;
  try {
    saved = new Set((await entries<string, SavedGuide>(guides())).map(([k]) => k));
  } catch {
    saved = new Set();
  }
  changed();
  return saved;
}

export function useSavedGuides(): Set<string> {
  const [, kick] = useState(0);
  useEffect(() => {
    void readKeys().then(() => kick((n) => n + 1));
  }, []);
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => saved ?? EMPTY,
    () => EMPTY
  );
}
const EMPTY = new Set<string>();

export async function saveGuides(copies: SavedGuide[]): Promise<void> {
  await Promise.all(copies.map((c) => set(c.key, c, guides())));
  saved = new Set([...(await readKeys()), ...copies.map((c) => c.key)]);
  changed();
}

export async function forgetGuide(key: string): Promise<void> {
  await del(key, guides());
  const next = new Set(await readKeys());
  next.delete(key);
  saved = next;
  changed();
}

/** Bring this ministry's saved copies up to date with what the app holds.
 *  `pruneMissing`: the ministry's guides loaded, so a saved one that's gone
 *  was removed by a leader — forget it too. */
export async function refreshSaved(org: string, current: SavedGuide[], pruneMissing: boolean): Promise<void> {
  const keys = await readKeys();
  const mine = [...keys].filter((k) => k.startsWith(org + ':'));
  if (!mine.length) return;
  const byKey = new Map(current.map((c) => [c.key, c]));
  const keep = mine.map((k) => byKey.get(k)).filter((c): c is SavedGuide => !!c);
  if (keep.length) await Promise.all(keep.map((c) => set(c.key, c, guides())));
  if (pruneMissing) for (const k of mine) if (!byKey.has(k)) await forgetGuide(k);
}

/** Mounted once in the phone shell: whenever the ministry's guides change,
 *  the copies this phone saved change with them. */
export function useKeepSavedGuides(groups: SmallGroup[], org: string, ministry: string, ready: boolean, loadFailed: boolean) {
  useEffect(() => {
    if (!ready) return;
    void refreshSaved(org, groups.map((g) => offlineCopy(g, org, ministry, Date.now())), !loadFailed).catch(() => undefined);
  }, [groups, org, ministry, ready, loadFailed]);
}
