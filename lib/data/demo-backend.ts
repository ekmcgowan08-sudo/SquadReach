/* DEMO MODE — the whole ministry lives on this device. Every change is a
   snapshot write; there is nothing to sync and nobody else to hear from. */
import type { Backend } from '@/lib/data/backend';
import { demoMinistry } from '@/lib/data/seed';
import type { MinistryData } from '@/lib/types/model';

export const SNAPSHOT_KEY = 'squadrise_demo_v1';

let saveT: ReturnType<typeof setTimeout> | null = null;
let pending: MinistryData | null = null;

function flush() {
  if (!pending) return;
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(pending));
  } catch {
    /* storage full or blocked — the session still works, it just won't survive a reload */
  }
  pending = null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
}

export const demoBackend: Backend = {
  mode: 'demo',
  async load() {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MinistryData;
        /* A snapshot from an older build may be missing fields; fill them
           from a fresh seed rather than crash on first read. */
        return { ...demoMinistry(), ...parsed };
      }
    } catch {
      /* fall through to a fresh seed */
    }
    return demoMinistry();
  },
  saveSnapshot(d) {
    pending = d;
    if (saveT) clearTimeout(saveT);
    saveT = setTimeout(flush, 400);
  },
  async pushEntries() {},
  async decideEntries() {},
  async sync() {},
  /* Demo files never leave the phone; tiles read them from IndexedDB. */
  async fileUrl() {
    return null;
  },
  subscribe() {
    return () => {};
  }
};

export function resetDemo() {
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    /* ignore */
  }
}
