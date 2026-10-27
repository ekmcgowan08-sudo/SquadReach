/* Every screen in the app as one table: the gate each route checks, the
   More row that opens it, and where the rest are reached from. The More menu
   reads its gates from here and the Screen map sheet prints from here; a
   test reads every page.tsx, so a route's own requireGate() can't disagree
   with this table, and a row can't show a role a screen it would refuse. */
import { GATES, type GateName } from '@/lib/gates';
import { canScore } from '@/lib/permissions';
import type { Persona } from '@/lib/types/domain';

/** Every signed-in route, with the gate its page (or its layout) checks. */
export const ROUTES = {
  '/dashboard': 'any',
  '/dashboard/access-requests': 'approve',
  '/dashboard/admin-view': 'adminView',
  '/dashboard/approvals': 'approve',
  '/dashboard/attendance': 'attendance',
  '/dashboard/audit': 'approve',
  '/dashboard/awards': 'any',
  '/dashboard/badges': 'any',
  '/dashboard/bible': 'any',
  '/dashboard/calendar': 'any',
  '/dashboard/captain-view': 'captainView',
  '/dashboard/chat': 'any',
  '/dashboard/coach-view': 'coachView',
  '/dashboard/congregation-view': 'congregationView',
  '/dashboard/door': 'door',
  '/dashboard/events/[id]': 'any',
  '/dashboard/follow-ups': 'member',
  '/dashboard/game-rules': 'any',
  '/dashboard/games': 'event',
  '/dashboard/here': 'member',
  '/dashboard/huddle': 'huddle',
  '/dashboard/library': 'library',
  '/dashboard/live': 'member',
  '/dashboard/media': 'any',
  '/dashboard/more': 'any',
  '/dashboard/night-recap': 'nightRecap',
  '/dashboard/notifications': 'any',
  '/dashboard/parent-link': 'board',
  '/dashboard/parent-view': 'parentView',
  '/dashboard/parents': 'parents',
  '/dashboard/prep-week': 'prep',
  '/dashboard/races': 'member',
  '/dashboard/recap': 'recap',
  '/dashboard/report': 'member',
  '/dashboard/score': 'score',
  '/dashboard/season-plan': 'any',
  '/dashboard/serving': 'serve',
  '/dashboard/settings': 'any',
  '/dashboard/submit-points': 'submit',
  '/dashboard/team': 'teamView',
  '/dashboard/walkthrough': 'approve',
  '/console': 'approve',
  '/planner': 'approve',
  '/planner/prep': 'approve',
  '/planner/people': 'approve',
  '/planner/roadmap': 'approve',
  '/planner/year': 'approve',
  '/planner/season': 'approve',
  '/planner/live': 'approve',
  '/planner/coverage': 'approve',
  '/planner/liturgical': 'approve',
  '/planner/settings': 'approve',
  '/planner/setup': 'approve',
  '/planner/one-pager': 'approve',
  '/projector': 'event',
  '/live/room': 'event'
} as const satisfies Record<string, GateName>;

export type Route = keyof typeof ROUTES;

/** The route an href lands on: the path without its query. */
export const routeOf = (href: string) => href.split('?')[0].split('#')[0];

export interface TabSlot {
  href: string;
  label: string;
  icon: string;
}

/* ── the tab bar ──────────────────────────────────────────────────────────
   Five slots. The second is the screen your role lives on; the centre is
   Score for SCORE_ENTRY_ROLES and Bible for everyone else. */
export const ROLE_TAB: Record<Persona, TabSlot> = {
  owner: { href: '/console', label: 'Console', icon: 'ph-gauge' },
  scorekeeper: { href: '/dashboard/games', label: 'Timer', icon: 'ph-timer' },
  coach: { href: '/dashboard/coach-view', label: 'Squad', icon: 'ph-megaphone' },
  leader: { href: '/dashboard/coach-view', label: 'Squad', icon: 'ph-megaphone' },
  captain: { href: '/dashboard/captain-view', label: 'Squad', icon: 'ph-flag' },
  member: { href: '/dashboard/team', label: 'Squad', icon: 'ph-users-three' },
  parent: { href: '/dashboard/parent-view', label: 'Family', icon: 'ph-users' },
  congregation: { href: '/dashboard/congregation-view', label: 'Board', icon: 'ph-church' }
};

export const TABS = {
  home: { href: '/dashboard', label: 'Home', icon: 'ph-house' },
  score: { href: '/dashboard/score', label: 'Score', icon: 'ph-lightning' },
  bible: { href: '/dashboard/bible', label: 'Bible', icon: 'ph-book-open-text' },
  chat: { href: '/dashboard/chat', label: 'Chat', icon: 'ph-chat-circle-dots' },
  more: { href: '/dashboard/more', label: 'More', icon: 'ph-dots-three-circle' }
} as const satisfies Record<string, TabSlot>;

/** The bar this role gets, left to right. */
export const tabBar = (p: Persona): TabSlot[] => [TABS.home, ROLE_TAB[p], canScore(p) ? TABS.score : TABS.bible, TABS.chat, TABS.more];

/** What each slot is for, in the order the bar shows them. */
export const TAB_NOTES = [
  'Standings, the approval queue, the week’s badges and what your role should do next',
  'The screen your role lives on — the console, the game timer, your squad, your family or the public board',
  'Point entry and Live Now for anyone who scores; the Bible for everyone else',
  'Threads by tier, with an unread count on the tab',
  'The index below, with search and a Recent row'
] as const;

/* ── the desk ─────────────────────────────────────────────────────────── */
export const PLANNER_NAV = [
  { href: '/planner', label: 'Home', key: 'h', icon: 'ph ph-house', what: 'Tonight’s run, the ready check and the needs list, shared live with the phone’s Tonight card.' },
  { href: '/planner/prep', label: 'Prep & recap', key: 'w', icon: 'ph ph-calendar-check', what: 'The week around a night: four reminders before it, attendance and 48-hour follow-ups after.' },
  { href: '/planner/people', label: 'People', key: 'p', icon: 'ph ph-users-three', what: 'Volunteer schedule, availability, swap approvals and invites; parent messages, slips and pickup.' },
  { href: '/planner/roadmap', label: 'Roadmap', key: 'r', icon: 'ph ph-map-trifold', what: 'All seven ministry years at once, one row each — where a plan is shaped before any night exists.' },
  { href: '/planner/year', label: 'Ministry year', key: 'y', icon: 'ph ph-columns', what: 'One year, August to July, as seasons and the series inside them.' },
  { href: '/planner/season', label: 'Season & night', key: 'n', icon: 'ph ph-moon-stars', what: 'A season’s gatherings and one night’s teaching detail side by side.' },
  { href: '/planner/live', label: 'Live', key: 'm', icon: 'ph ph-broadcast', what: 'Live ministry time: the room screen and the students’ phones, run from one place.' },
  { href: '/planner/coverage', label: 'Coverage', key: 'c', icon: 'ph ph-grid-four', what: 'Categories against graduating classes, with the rule behind every warning.' },
  { href: '/planner/liturgical', label: 'Liturgical', key: 'l', icon: 'ph ph-circle-half', what: 'Seasons and movable days over the ministry year. Off until switched on.' },
  { href: '/planner/settings', label: 'Settings', key: 's', icon: 'ph ph-sliders-horizontal', what: 'Plan range, meeting night, seasons, roles and the people who hold them.' }
] as const satisfies readonly { href: Route; label: string; key: string; icon: string; what: string }[];

export interface MoreRow {
  label: string;
  icon: string;
  /** Absent for a row that does something rather than opening a screen. */
  href?: string;
  gate: GateName;
  /** Withheld from anyone this gate lets through (Prayer Wall vs Prayer & Care). */
  unless?: GateName;
  /** Only in the demo, or only on a real ministry. */
  mode?: 'demo' | 'live';
}

export interface MoreGroup {
  title: string;
  gate: GateName;
  rows: readonly MoreRowId[];
}

export const MORE_ROWS = {
  settings: { label: 'Settings', icon: 'ph ph-moon', href: '/dashboard/settings', gate: 'any' },
  notifications: { label: 'Notifications', icon: 'ph ph-bell', href: '/dashboard/notifications', gate: 'any' },
  access: { label: 'Access requests', icon: 'ph ph-user-focus', href: '/dashboard/access-requests', gate: 'approve' },
  badges: { label: 'Badges & Streaks', icon: 'ph ph-medal', href: '/dashboard/badges', gate: 'any' },
  pco: { label: 'Planning Center', icon: 'ph ph-plugs-connected', href: '/console?tab=people', gate: 'approve' },
  walkthrough: { label: 'Walkthrough', icon: 'ph ph-compass', href: '/dashboard/walkthrough', gate: 'approve' },
  offline: { label: 'Simulate no signal', icon: 'ph ph-cloud-slash', gate: 'any' },
  stale: { label: 'Plant an old held queue', icon: 'ph ph-clock-counter-clockwise', gate: 'any' },
  blank: { label: 'Preview a brand-new season', icon: 'ph ph-sparkle', gate: 'any', mode: 'demo' },
  reset: { label: 'Reset the demo', icon: 'ph ph-arrow-counter-clockwise', gate: 'any', mode: 'demo' },
  signOut: { label: 'Sign out', icon: 'ph ph-sign-out', gate: 'any', mode: 'live' },

  bible: { label: 'Bible & Memory', icon: 'ph ph-book-open-text', href: '/dashboard/bible', gate: 'any' },
  care: { label: 'Prayer & Care', icon: 'ph ph-hands-praying', href: '/dashboard/follow-ups', gate: 'care' },
  wall: { label: 'Prayer Wall', icon: 'ph ph-hands-praying', href: '/dashboard/follow-ups', gate: 'member', unless: 'care' },

  coachView: { label: 'Coach view', icon: 'ph ph-megaphone', href: '/dashboard/coach-view', gate: 'coachView' },
  captainView: { label: 'Captain view', icon: 'ph ph-flag', href: '/dashboard/captain-view', gate: 'captainView' },
  adminView: { label: 'Admin view', icon: 'ph ph-buildings', href: '/dashboard/admin-view', gate: 'adminView' },
  parentView: { label: 'Parent view', icon: 'ph ph-users', href: '/dashboard/parent-view', gate: 'parentView' },
  congregationView: { label: 'Congregation view', icon: 'ph ph-church', href: '/dashboard/congregation-view', gate: 'congregationView' },
  teamView: { label: 'Team view', icon: 'ph ph-users-three', href: '/dashboard/team', gate: 'teamView' },

  live: { label: 'Live', icon: 'ph ph-broadcast', href: '/dashboard/live', gate: 'member' },
  prep: { label: 'Prep week', icon: 'ph ph-calendar-check', href: '/dashboard/prep-week', gate: 'prep' },
  nightRecap: { label: 'Night recap', icon: 'ph ph-clipboard-text', href: '/dashboard/night-recap', gate: 'nightRecap' },
  serving: { label: 'Serving & swaps', icon: 'ph ph-swap', href: '/dashboard/serving', gate: 'serve' },
  parents: { label: 'Message parents', icon: 'ph ph-chat-circle-text', href: '/dashboard/parents', gate: 'parents' },
  door: { label: 'Door kiosk', icon: 'ph ph-device-tablet', href: '/dashboard/door', gate: 'door' },
  tour: { label: 'Tour the app', icon: 'ph ph-signpost', gate: 'any' },
  huddle: { label: 'Huddle & run sheet', icon: 'ph ph-users-four', href: '/dashboard/huddle', gate: 'huddle' },
  games: { label: 'Game timer', icon: 'ph ph-timer', href: '/dashboard/games', gate: 'event' },
  submit: { label: 'Submit Points', icon: 'ph ph-paper-plane-tilt', href: '/dashboard/submit-points', gate: 'submit' },
  media: { label: 'Media & Film', icon: 'ph ph-camera', href: '/dashboard/media', gate: 'any' },
  rules: { label: 'Game Rules', icon: 'ph ph-clipboard-text', href: '/dashboard/game-rules', gate: 'any' },

  recap: { label: 'Weekly Recap Card', icon: 'ph ph-share-network', href: '/dashboard/recap', gate: 'recap' },
  attendance: { label: 'Attendance Map', icon: 'ph ph-grid-nine', href: '/dashboard/attendance', gate: 'attendance' },
  board: { label: 'Parent Board Link', icon: 'ph ph-link', href: '/dashboard/parent-link', gate: 'board' },
  races: { label: 'Races', icon: 'ph ph-target', href: '/dashboard/races', gate: 'member' },
  calendar: { label: 'Calendar', icon: 'ph ph-calendar-dots', href: '/dashboard/calendar', gate: 'any' },
  library: { label: 'Library', icon: 'ph ph-magnifying-glass', href: '/dashboard/library', gate: 'library' },
  season: { label: 'Season & Small Groups', icon: 'ph ph-list-checks', href: '/dashboard/season-plan', gate: 'any' },
  awards: { label: 'Trophies & Awards', icon: 'ph ph-trophy', href: '/dashboard/awards', gate: 'any' },

  approvals: { label: 'Approval Queue', icon: 'ph ph-seal-check', href: '/dashboard/approvals', gate: 'approve' },
  people: { label: 'People & Roles', icon: 'ph ph-users-three', href: '/console?tab=people', gate: 'approve' },
  audit: { label: 'Audit Log', icon: 'ph ph-list-magnifying-glass', href: '/dashboard/audit', gate: 'approve' },
  console: { label: 'Web Dashboard', icon: 'ph ph-gauge', href: '/console', gate: 'approve' },
  planner: { label: 'Planner', icon: 'ph ph-map-trifold', href: '/planner', gate: 'approve' },
  projector: { label: 'Projector Mode', icon: 'ph ph-projector-screen', href: '/projector', gate: 'event' }
} as const satisfies Record<string, MoreRow>;

export type MoreRowId = keyof typeof MORE_ROWS;

/** The More index, in order. A group's gate withholds every row in it. */
export const MORE_GROUPS: readonly MoreGroup[] = [
  { title: 'Account', gate: 'any', rows: ['settings', 'notifications', 'access', 'badges', 'pco', 'walkthrough', 'offline', 'stale', 'blank', 'reset', 'signOut'] },
  { title: 'Discipleship', gate: 'any', rows: ['bible', 'care', 'wall'] },
  { title: 'Views', gate: 'any', rows: ['coachView', 'captainView', 'adminView', 'parentView', 'congregationView', 'teamView'] },
  { title: 'Tonight', gate: 'member', rows: ['live', 'prep', 'nightRecap', 'serving', 'parents', 'door', 'tour', 'huddle', 'games', 'submit', 'media', 'rules'] },
  { title: 'Season', gate: 'member', rows: ['recap', 'attendance', 'board', 'races', 'calendar', 'library', 'season', 'awards'] },
  { title: 'Oversight', gate: 'approve', rows: ['approvals', 'people', 'audit', 'console', 'planner', 'projector'] }
];

const groupOf = (id: MoreRowId) => MORE_GROUPS.find((g) => g.rows.includes(id))!;

/** Does this role see the row on More? Group gate, row gate, and mode. */
export function moreRowShows(id: MoreRowId, p: Persona, demo = true): boolean {
  const r: MoreRow = MORE_ROWS[id];
  if (r.mode && r.mode !== (demo ? 'demo' : 'live')) return false;
  if (!GATES[groupOf(id).gate](p) || !GATES[r.gate](p)) return false;
  return !(r.unless && GATES[r.unless](p));
}

/** Screens with no row on More: opened from inside another one. */
export const NESTED: readonly { label: string; from: string; href?: Route }[] = [
  { label: 'Event detail and its RSVP list', from: 'Calendar, Home or a notification', href: '/dashboard/events/[id]' },
  { label: 'A chat thread', from: 'the thread list on Chat' },
  { label: 'Live Now', from: 'Score, below the pad' },
  { label: 'Door check-in', from: 'the QR code on Night recap', href: '/dashboard/here' },
  { label: 'A delivered report', from: 'its notification', href: '/dashboard/report' },
  { label: 'Small-group player', from: 'Season & Small Groups' },
  { label: 'Bible chapter', from: 'Bible & Memory' },
  { label: 'Award vote', from: 'Trophies & Awards' },
  { label: 'Library unit sheet', from: 'a Library result' },
  { label: 'Squad pushes / Individuals', from: 'Races, as a switch' },
  { label: 'Weeks / Small groups', from: 'Season & Small Groups, as a switch' },
  { label: 'Prayer / Care', from: 'Prayer & Care, as a switch' },
  { label: 'Seven-year setup', from: 'the planner’s Roadmap', href: '/planner/setup' },
  { label: 'The one-pager', from: 'the planner’s Roadmap', href: '/planner/one-pager' },
  { label: 'The room screen', from: 'Live ministry time', href: '/live/room' }
];

/** No route of their own — they sit over whatever screen is open. */
export const OVERLAYS = [
  'Role switch sheet',
  'Invite sheet',
  'Student search',
  'Onboarding tour',
  'Photo viewer',
  'Push banner',
  'No-signal banner',
  'Toast'
] as const;

/** How moving around behaves — the same promises the code keeps. */
export const NAV_NOTES = [
  'Back walks a real back stack, not a fixed parent. Event detail returns to whichever screen opened it, and a screen opened from a Recent chip returns to More.',
  'The Recent row appears at the top of More once two or more deep screens have been visited, and hides while a search is active.',
  'Switching role or signing out clears the back stack and the Recent row together, so nobody lands on a screen their new role cannot hold.',
  'Every route checks its own gate on the server and again on the phone, so a deep link is never the hole in a hidden row.'
] as const;
