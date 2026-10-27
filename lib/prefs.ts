'use client';
/* Per-device preferences: theme, motion, which Home sections show and which
   notifications reach you. These are conveniences for this phone only, so
   they live in localStorage and every read survives it being unavailable. */
import { useSyncExternalStore } from 'react';
import { PREFS_KEY } from '@/lib/prefs-boot';

export const NOTIF_TRIGGERS = [
  { key: 'event', label: 'Upcoming events', hint: 'Reminder the day before' },
  { key: 'approvals', label: 'Points waiting on you', hint: 'When a coach or captain sends some in' },
  { key: 'roleRequest', label: 'Role requests', hint: 'When someone asks for access' },
  { key: 'prayer', label: 'Prayer requests', hint: 'When one is filed for review' },
  { key: 'weeklySummary', label: 'Weekly summary', hint: 'Points and standings recap' },
  { key: 'runSheet', label: 'Run sheet assignments', hint: 'When the huddle sheet is published' },
  { key: 'streakBreak', label: 'Streak about to break', hint: 'Nudge before it resets' },
  { key: 'bibleReminder', label: 'Bible reading reminder', hint: 'When review is due' },
  { key: 'nightCycle', label: 'The week around the night', hint: 'Prep reminders, swaps, the door, follow-ups' },
  { key: 'reportDelivery', label: 'Scheduled reports', hint: 'When one reaches you, and what goes out today' }
] as const;
export type NotifTrigger = (typeof NOTIF_TRIGGERS)[number]['key'];

export const HOME_SECTIONS = [
  { key: 'standings', label: 'Live standings', icon: 'ph ph-chart-bar' },
  { key: 'feed', label: 'Recent score changes', icon: 'ph ph-pulse' },
  { key: 'badges', label: 'This week’s badges', icon: 'ph ph-medal' },
  { key: 'church', label: 'Find us / church info', icon: 'ph ph-church' }
] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number]['key'];

export interface Prefs {
  theme: 'dark' | 'light';
  reduceMotion: boolean;
  homeSections: Record<HomeSection, boolean>;
  /** Notifications this person switched on or off themselves. Anything
   *  not here follows the ministry's default (Console › Notifications). */
  notifMine: Partial<Record<NotifTrigger, boolean>>;
  tourSeen: boolean;
  /** The walkthrough: on, and which step. Survives navigation and reloads. */
  tour: { on: boolean; i: number };
  /** The planner's leader tour, across the desk screens. */
  deskTour: { on: boolean; i: number };
  /** Demo only: the moment of the week the night-cycle screens preview. */
  cyclePreview: string | null;
  /** Walkthrough chapters this person has ticked off. */
  walkthroughDone: Record<string, boolean>;
  /** The planner's printed one-pager: paper size and ground. */
  onePager: { paper: 'letter' | 'a4'; ground: 'light' | 'dark' };
  /** Console › Reports: the at-a-glance views this person has turned off. */
  reportViewsOff: Record<string, boolean>;
}

const DEFAULTS: Prefs = {
  theme: 'dark',
  reduceMotion: false,
  homeSections: { standings: true, feed: true, badges: true, church: true },
  notifMine: {},
  tourSeen: false,
  tour: { on: false, i: 0 },
  deskTour: { on: false, i: 0 },
  cyclePreview: null,
  walkthroughDone: {},
  onePager: { paper: 'letter', ground: 'light' },
  reportViewsOff: {}
};

let current: Prefs = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function load(): Prefs {
  if (loaded) return current;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Prefs> & { notifTriggers?: Record<string, boolean> };
      /* Phones saved every trigger before ministry defaults existed, all on
         unless switched off, so only an "off" there was a choice. */
      const old = p.notifTriggers ? Object.fromEntries(Object.entries(p.notifTriggers).filter(([, v]) => v === false)) : {};
      delete p.notifTriggers;
      current = {
        ...DEFAULTS,
        ...p,
        homeSections: { ...DEFAULTS.homeSections, ...p.homeSections },
        notifMine: p.notifMine ?? old,
        onePager: { ...DEFAULTS.onePager, ...p.onePager }
      };
    }
  } catch {
    /* private window or blocked storage: defaults it is */
  }
  return current;
}

export function applyPrefs(p: Prefs) {
  const el = document.documentElement;
  el.dataset.theme = p.theme;
  if (p.reduceMotion) el.dataset.motion = 'reduce';
  else delete el.dataset.motion;
  el.style.colorScheme = p.theme;
}

export function setPrefs(patch: Partial<Prefs> | ((p: Prefs) => Partial<Prefs>)) {
  const base = load();
  current = { ...base, ...(typeof patch === 'function' ? patch(base) : patch) };
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(current));
  } catch {
    /* kept for this session only */
  }
  applyPrefs(current);
  listeners.forEach((l) => l());
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    load,
    () => DEFAULTS
  );
}

/** Which notifications reach this person: their own choice, else the
 *  ministry's default, else on. */
export function notifOn(ministry: Partial<Record<string, boolean>> | undefined, mine: Partial<Record<NotifTrigger, boolean>>): Record<NotifTrigger, boolean> {
  return Object.fromEntries(NOTIF_TRIGGERS.map((t) => [t.key, mine[t.key] ?? ministry?.[t.key] ?? true])) as Record<NotifTrigger, boolean>;
}
