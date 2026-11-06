/* DEMO MODE — the whole ministry lives on this device. Every change is a
   snapshot write; there is nothing to sync and nobody else to hear from. */
import type { Backend } from '@/lib/data/backend';
import { demoLive } from '@/lib/data/demo-live';
import { DEFAULT_CONFIG, emptyMinistry } from '@/lib/data/empty';
import { DEMO_NIGHT, demoNightFor, moveDemo } from '@/lib/data/demo-week';
import { demoMinistry } from '@/lib/data/seed';
import type { MinistryData } from '@/lib/types/model';

export const SNAPSHOT_KEY = 'squadrise_demo_v1';
/** The night the saved demo's dates are on (lib/data/demo-week). */
const NIGHT_KEY = 'squadrise_demo_night';

const storedNight = () => {
  try {
    return localStorage.getItem(NIGHT_KEY) ?? DEMO_NIGHT;
  } catch {
    return DEMO_NIGHT;
  }
};
const keep = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked: it's worked out again next time */
  }
};

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

/** The demo as this phone has it, on the coming night's dates. The app, the
 *  public board and the family link all read it this way. */
export function readDemo(): MinistryData {
  const want = demoNightFor(Date.now());
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MinistryData;
      const was = storedNight();
      /* A snapshot from an older build may be missing fields; fill them
         from a fresh seed (on the snapshot's own dates) rather than crash
         on first read. Config is merged a level deeper, since new
         settings land inside it. */
      const seed = moveDemo(demoMinistry(), DEMO_NIGHT, was);
      const merged: MinistryData = { ...seed, ...parsed, config: { ...seed.config, ...parsed.config, cycle: { ...seed.config.cycle, ...parsed.config?.cycle } }, tonight: { ...seed.tonight, ...parsed.tonight }, game: { ...seed.game, ...parsed.game } };
      if (was === want) return merged;
      /* A new week since this phone last opened the demo: everything
         moves to the coming night, and that night starts fresh. */
      const fresh = moveDemo(demoMinistry(), DEMO_NIGHT, want);
      const moved = { ...moveDemo(merged, was, want), tonight: fresh.tonight, huddle: fresh.huddle, game: fresh.game };
      keep(SNAPSHOT_KEY, JSON.stringify(moved));
      keep(NIGHT_KEY, want);
      return moved;
    }
  } catch {
    /* fall through to a fresh seed */
  }
  keep(NIGHT_KEY, want);
  return moveDemo(demoMinistry(), DEMO_NIGHT, want);
}

export const demoBackend: Backend = {
  mode: 'demo',
  async load() {
    /* A save still waiting goes first, so a reload reads it back. */
    flush();
    return readDemo();
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
    localStorage.removeItem(NIGHT_KEY);
  } catch {
    /* ignore */
  }
}
