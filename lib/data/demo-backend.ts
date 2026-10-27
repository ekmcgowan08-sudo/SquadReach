/* DEMO MODE — the whole ministry lives on this device. Every change is a
   snapshot write; there is nothing to sync and nobody else to hear from. */
import type { Backend } from '@/lib/data/backend';
import { demoLive } from '@/lib/data/demo-live';
import { DEFAULT_CONFIG, emptyMinistry } from '@/lib/data/empty';
import { demoMinistry } from '@/lib/data/seed';
import type { MinistryData } from '@/lib/types/model';

export const SNAPSHOT_KEY = 'squadrise_demo_v1';

let saveT: ReturnType<typeof setTimeout> | null = null;
let pending: MinistryData | null = null;

/* A reset or a blank preview replaces the snapshot; a save still waiting
   must not write the old data back on the way out. */
function dropPending() {
  pending = null;
  if (saveT) clearTimeout(saveT);
}

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
           from a fresh seed rather than crash on first read. Config is
           merged a level deeper, since new settings land inside it. */
        const seed = demoMinistry();
        return { ...seed, ...parsed, config: { ...seed.config, ...parsed.config, cycle: { ...seed.config.cycle, ...parsed.config?.cycle } }, tonight: { ...seed.tonight, ...parsed.tonight }, game: { ...seed.game, ...parsed.game } };
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
  },
  live: demoLive
};

/** The demo as a ministry on its first day: no squads, no roster, nothing
 *  scored — what the setup checklist and empty states look like. "Reset the
 *  demo" brings week 9 back. */
export function previewBlankDemo() {
  dropPending();
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ ...emptyMinistry(), config: { ...DEFAULT_CONFIG, ministryName: 'Your ministry' } }));
  } catch {
    /* storage blocked: the preview can't stick */
  }
}

export function resetDemo() {
  dropPending();
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    /* ignore */
  }
}
