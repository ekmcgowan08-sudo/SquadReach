/* The ministry's data, as the app holds it. Field names follow the design
   prototype's state on purpose, so behaviour can be diffed against it. The
   Supabase tables (supabase/migrations) map onto these one to one; see
   lib/data/supabase-backend.ts for the mapping. */
import type { MembershipRole, Persona, ScoreEntryStatus } from './domain';
import type { SavedSeason } from '@/lib/season';
import type { Plan } from '@/lib/plan';
import type { DraftSettings, TradeRecord } from '@/lib/draft';
import type { OverlaySettings } from '@/lib/scorebug';

export interface Team {
  id: string;
  name: string;
  color: string;
  mascotName: string;
  mascotStory: string;
  sort: number;
}

export interface Category {
  id: string;
  label: string;
  color: string;
  icon: string;
  hint: string;
}

export interface Student {
  id: string;
  name: string;
  team: string | null;
  grade: string;
  captain?: boolean;
  guest?: boolean;
  /** Added from the floor tonight — not yet in the church directory. */
  newInDb?: boolean;
}

/** Detail behind a check-in row. The ledger keeps the detail, not just the
 *  total, so a corrected entry can be recomputed and reports rebuilt. */
export interface EntryDetail {
  count?: number;
  articles?: number;
  verses?: number;
  proof?: boolean;
  place?: string;
  friends?: string[];
  /** Friends already in the directory, or new to the ministry. */
  friendKind?: 'known' | 'new';
  /** Which board a verse count came from. */
  verseSet?: 'sunday' | 'week';
  /** Photo proof, shrunk on the phone to a small JPEG data URL. */
  photo?: string;
}

/** Every point change in the app is one of these. Nothing writes a total. */
export interface LedgerEntry {
  /** Client-generated uuid. score_entries is UNIQUE on it, so a replayed
   *  outbox can never double-post. */
  id: string;
  team: string;
  cat: string;
  amount: number;
  /** Display name of whoever entered it, at the time. */
  by: string;
  byMembershipId?: string | null;
  why: string;
  /** Client time the tap happened — replay order for the audit log. */
  at: number;
  /** Only 'approved' rows count toward a total. */
  status: ScoreEntryStatus;
  student?: string | null;
  detail?: EntryDetail | null;
  /** Entries posted by one action (attendance for 28) share a batch, so the
   *  approval queue shows one row a pastor can clear in one tap. */
  batch?: string | null;
  /** Set on the reversal row of an undo. The original stays in the ledger. */
  reverses?: string | null;
  decidedBy?: string | null;
  decidedAt?: number | null;
}

/** Something written while there was no signal, held until there is. */
export type HeldOp =
  | { kind: 'entry'; id: string; at: number; entry: LedgerEntry }
  | { kind: 'decide'; id: string; at: number; ids: string[]; status: ScoreEntryStatus; by: string };

export interface PrayerRequest {
  id: string;
  who: string;
  meta: string;
  body: string;
  praying: number;
  prayed: boolean;
  answered: boolean;
  at: number;
}

export interface PrayerQueued {
  id: string;
  who: string;
  meta: string;
  body: string;
  at: number;
}

export interface CareReminder {
  id: string;
  initials: string;
  name: string;
  meta: string;
  flaggedBy?: string;
  at?: number;
  done?: boolean;
  /** 'note' rows are private coach notes; they never close. */
  kind?: 'followup' | 'note';
  body?: string;
}

export type AudienceId = 'members' | 'captains' | 'coaches' | 'scorekeeper' | 'leaders' | 'parents' | 'admins';

export interface MinistryEvent {
  id: string;
  title: string;
  meta: string;
  /** Display label ('Oct 22'); derived from `iso` when there is one. */
  date: string;
  color: string;
  roles: AudienceId[];
  iso?: string | null;
  time?: string;
  place?: string;
  /** Coaches, captains and scorekeepers propose; LEADER_ROLES approve. */
  status?: 'proposed' | 'approved';
  by?: string;
  rsvpClosed?: boolean;
  /** Local day a leader last nudged the no-replies (one a day). */
  nudgedOn?: string;
}

/** A quick start on the phone's event composer: fills the name, time,
 *  place, colour and who it goes to. */
export interface EventType {
  id: string;
  title: string;
  time: string;
  place?: string;
  color: string;
  roles: AudienceId[];
}

export const DEFAULT_EVENT_TYPES: EventType[] = [
  { id: 'et1', title: 'Squad hangout', time: '7:00p', color: '#2563EB', roles: ['members', 'captains', 'coaches', 'leaders'] },
  { id: 'et2', title: 'Coaches’ lunch', time: '12:30p', color: '#968ae0', roles: ['coaches', 'leaders', 'admins'] },
  { id: 'et3', title: 'Serve day', time: '9:00a', color: '#0D9488', roles: ['members', 'captains', 'coaches', 'scorekeeper', 'leaders', 'parents', 'admins'] }
];

export interface Challenge {
  id: string;
  kind: 'Team' | 'Individual';
  title: string;
  body: string;
  pointsLabel: string;
  status: string;
  done: boolean;
  team?: string;
  cat?: string;
  amount?: number;
  /** Season weeks it runs in; absent means every week, empty means paused. */
  weeks?: number[] | null;
}

export interface MediaSpot {
  id: string;
  /** The type, named by the ministry: "Mascot bit", "Commercial"… */
  kind: string;
  title: string;
  note: string;
  color: string;
  weeks?: number[] | null;
}

export interface AccessRequest {
  id: string;
  name: string;
  email: string;
  personType: string;
  household: string;
  meta: string;
  requestedRole: Persona;
  flagged: boolean;
  note: string;
  at: number;
  status: 'pending' | 'approved' | 'denied';
}

export interface ActivityLine {
  id: string;
  line: string;
  at: number;
}

export interface ChurchInfo {
  address: string;
  phone: string;
  email: string;
  web: string;
  studentsPage: string;
  instagram: string;
  youtube: string;
  facebook: string;
  tiktok: string;
}

export interface MinistryConfig {
  ministryName: string;
  /** The week around the night: times, reminders, serving roles. */
  cycle: CycleConfig;
  /** The live season's name, from the season interview. */
  seasonName?: string;
  pointBase: number;
  weekGrowthPct: number;
  goalValue: number;
  versePts: number;
  verseBoard: number;
  weekNumber: number;
  seasonWeeks: number;
  meetingDates: string[];
  gameName: string;
  venueAddress: string;
  parentCode: string;
  /** Shared to ask for access (organizations.invite_code). */
  inviteCode: string;
  church: ChurchInfo;
  /** Categories that attendance posting also pays, beyond General. */
  checkinAutoCats: Record<string, boolean>;
  memoryVerses: MemoryVerse[];
  /** Draft day (Console › Draft & trades); absent until it's first set. */
  draft?: DraftSettings;
  /** Every squad move made as a trade, newest first. */
  trades?: TradeRecord[];
  /** Spots to film or play on the night: mascot bits, commercials, hype
   *  videos. Weeks as for challenges: absent means every week. */
  mediaSpots?: MediaSpot[];
  /** Quick starts staff see when they add or propose an event. Absent
   *  means DEFAULT_EVENT_TYPES. */
  eventTypes?: EventType[];
  /** Which notifications are on for everyone unless they change their own
   *  (keys of lib/prefs NOTIF_TRIGGERS). Absent means on. */
  notifDefaults?: Partial<Record<string, boolean>>;
  /** What the scoreboard burned into game film shows (lib/scorebug). */
  overlay?: Partial<OverlaySettings>;
  /** Memory drills by week (lib/bible drillsIn): absent means every week. */
  drillWeeks?: Partial<Record<'flashcard' | 'firstletter' | 'blank' | 'type' | 'say' | 'scramble', number[]>>;
  penalties: Penalty[];
  gameSetup: GameSetup;
  /** What the public parent board (/b/[parentCode]) shows. */
  parentShare: ParentShare;
  /** Game film in the week album: off until an owner or leader turns it
   *  on, with a size limit per clip and how long uploads are kept. */
  filmUpload?: FilmUpload;
  /** IANA zone the ministry meets in — the server sends scheduled reports
   *  by this clock. Absent means America/Chicago. */
  timeZone?: string;
}

export interface FilmUpload {
  on: boolean;
  maxMb: number;
  keepDays: number;
}
export const FILM_DEFAULTS: FilmUpload = { on: false, maxMb: 80, keepDays: 60 };

export interface ParentShare {
  standings: boolean;
  mvp: boolean;
  verse: boolean;
  photos: boolean;
  calendar: boolean;
}

/** What players see on Game rules — set in Console · Scoring. */
export interface GameSetup {
  rulesText: string;
  /** YouTube link; shown embedded. */
  rulesVideoUrl: string;
  fieldTypes: string[];
  /** Overrides the home venue when the game moves. */
  offsiteAddress: string;
  /** The field drawing, as a data URL. */
  markupDataUrl: string | null;
  /** Weeks a game runs; null means every week. */
  gameWeeks: number[] | null;
}

/* ── The 6:15 huddle ─────────────────────────────────────────────────── */
export interface RunSheetItem {
  id: string;
  time: string;
  label: string;
  where: string;
  who: string;
  detail: string;
  debrief?: boolean;
  assignedTo: string | null;
  notifiedAt: number | null;
}

export interface CrewMember {
  id: string;
  name: string;
  job: string;
  post: string;
  team: string | null;
  sendHome: string;
}

export type CrewState = 'here' | 'late' | 'out';

export interface BenchVolunteer {
  id: string;
  name: string;
  meta: string;
}

export interface OpenPost {
  id: string;
  post: string;
  why: string;
}

export interface HuddleState {
  runSheet: RunSheetItem[];
  runIdx: number;
  runDone: Record<string, boolean>;
  runAdvancedAt: number;
  crew: CrewMember[];
  crewState: Record<string, CrewState | undefined>;
  crewAdded: string[];
  bench: BenchVolunteer[];
  openPosts: OpenPost[];
  covered: Record<string, string>;
  subAsks: Record<string, string[]>;
  note: string;
  debriefNotes: { id: string; text: string; week: number; at: number }[];
  nightClosed: boolean;
  /** Tonight's ready check — the Home Tonight card and the huddle share it. */
  ready: { id: string; label: string; who: string; done: boolean }[];
  /** "Needs you" rows a leader has cleared for tonight. */
  dismissed: Record<string, boolean>;
  /** Edited since it was last published — nobody has been told yet. */
  sheetDirty?: boolean;
}

export interface VisitorLogRow {
  id: string;
  names: string[];
  student: string;
  team: string;
  week: number;
  kind: 'new' | 'known';
  at: number;
}

export interface VerseLogRow {
  id: string;
  student: string;
  team: string;
  week: number;
  set: 'sunday' | 'week';
  label: string;
  count: number;
  pts: number;
}

/** The week's memory verse; text keyed by translation (KJV, ASV, RVR1909…). */
export interface MemoryVerse {
  week: number;
  ref: string;
  text: Record<string, string>;
}

/** One logged Bible practice. Leaders see that it happened, never a score. */
export interface PracticeRow {
  id: string;
  who: string;
  team: string | null;
  /** Local day, YYYY-MM-DD — one row per person per day. */
  day: string;
  ref: string;
  mode: string;
  at: number;
}

export interface Achievement {
  id: string;
  label: string;
  meta: string;
  who: string;
  team: string;
  at: number;
}

export interface StudentBadge {
  name: string;
  team: string;
  attendStreak: number;
  bibleStreak: number;
}

export interface DeepDay {
  day: string;
  ref: string;
  prompt: string;
}

export interface DeepSubmission {
  id: string;
  groupId: string;
  dayIdx: number;
  day: string;
  ref: string;
  prompt: string;
  student: string;
  team: string;
  text: string;
  at: number;
  status: 'pending' | 'approved' | 'sentBack';
  points: number;
  /** Paid once. Re-approving an edited answer never pays twice. */
  awarded?: boolean;
  decidedBy?: string;
}

export interface SmallGroupScreen {
  id: string;
  type: string;
  title: string;
  body: string;
  ref?: string;
  options?: string[];
  items?: string[];
  videoUrl?: string;
  timerSeconds?: number;
}

export interface SmallGroup {
  id: string;
  title: string;
  notes: string;
  screens: SmallGroupScreen[];
  weekNumber: number;
  deepDive?: {
    title: string;
    verseRef: string;
    verseText: string;
    days: DeepDay[];
    studentAsk: string;
    leaderPrep: string;
  };
}

/** A unit in the shared library. `church` is null for this ministry's own. */
export interface LibraryUnit {
  id: string;
  kind: string;
  title: string;
  church: string | null;
  span: string;
  theme: string;
  summary: string;
  includes: string[];
  /** Suggested point values, as [category, amount]. */
  pts: [string, number][];
  used: string;
  /** Ours, and out in the library for other ministries to read. */
  shared?: boolean;
  /** Ours: why other ministries reported it — never which ones. */
  flags?: LibraryFlag[];
}

export type LibraryFlagReason = 'names' | 'unsuitable' | 'wrong' | 'other';
export interface LibraryFlag {
  reason: LibraryFlagReason;
  note: string;
  at: number;
}

/** A library unit placed onto a week of this season. */
export interface LibraryPlacement {
  id: string;
  unit: string;
  title: string;
  kind: string;
  week: number;
  /** Whose point values the week uses — confirmed, never rescaled. */
  pts: 'theirs' | 'ours';
  at: number;
  /** A copy of the unit as it was when placed: if its author edits it later,
   *  this week doesn't change under you. */
  copy?: Pick<LibraryUnit, 'summary' | 'includes' | 'pts' | 'span' | 'theme'>;
  /** The authoring church, kept with the copy. Null when it's our own. */
  credit?: string | null;
}

export interface Award {
  id: string;
  name: string;
  description: string;
  decidedBy: 'score' | 'vote' | 'streak';
  categoryId?: string | null;
  recipientType?: 'team' | 'individual';
  votingOpen?: boolean;
  /** The voting window, as days (YYYY-MM-DD) in the ministry's zone. Both
   *  optional: voting is open while votingOpen is on and today falls
   *  inside whichever ends are set (lib/awards awardOpen). */
  votingStartDate?: string | null;
  votingEndDate?: string | null;
  voteFrequency?: string;
  nominees?: { id: string; name: string }[];
  metric?: 'bible' | 'attendance';
}

export interface MediaItem {
  id: string;
  week: number;
  kind: 'photo' | 'video' | 'audio';
  label: string;
  /** Storage path in the 'media' bucket (Supabase mode). */
  path?: string | null;
  /** IndexedDB key of the file on this phone, when it was taken here. */
  localKey?: string | null;
  /** Legacy/placeholder: a slot with neither path nor localKey shows as a label. */
  url?: string | null;
  by?: string;
  at: number;
}

/** A filmed clip. The video stays on the phone that filmed it (IndexedDB)
 *  until someone saves or shares it — nothing is uploaded on its own. */
export interface Clip {
  id: string;
  localKey: string;
  mime: string;
  dur: number;
  at: number;
  /** "YEL 320 · BLU 275" — the game-points line burned into the scorebug. */
  line: string;
  mb: number;
  week: number;
  /** Seconds into the clip where a highlight was pinned. */
  pins: number[];
  /** The album item it was added to, once uploaded. */
  uploaded?: string;
}

/** A highlight pinned while the camera was off — a note for the editor. */
export interface FilmMark {
  id: string;
  clock: string;
  period: string;
  at: number;
}

export interface ChatThread {
  id: string;
  kind: 'announce' | 'group' | 'team' | 'dm';
  name: string;
  sub: string;
  icon?: string;
  tint: string;
  /** Who may open it, and who may post — by persona. */
  read: Persona[];
  post: Persona[];
  /** A squad thread: students outside the squad never see it. */
  team?: string;
}

export interface ChatMessage {
  id: string;
  /** Display labels; derived from `at` for real messages. */
  day: string;
  time: string;
  at?: number;
  from?: string;
  roleLabel?: string;
  tint?: string;
  text: string;
  system?: boolean;
  mine?: boolean;
  status?: 'sent' | 'pending';
  heldAt?: number;
}

export interface Rsvp {
  status: 'going' | 'maybe' | 'out';
  guests: number;
  heldAt?: number;
}

export interface RsvpCount {
  going: number;
  maybe: number;
  out: number;
  guests: number;
}

/** Tonight's floor: who is here and what has been posted. Presence is
 *  roster data (ROSTER_EDIT_ROLES), and posting it IS the scoring step. */
/* ── Game timer ──────────────────────────────────────────────────────── */
/** A penalty or bonus button on every lane. Set per season, not per night. */
export interface Penalty {
  id: string;
  label: string;
  sec: number;
  kind: 'add' | 'subtract';
  icon?: string;
  color?: string;
  /** How the projector shows it: blur | chaos | glow | scale | confetti | flash. */
  style?: string;
  rule?: string;
}

/** One squad's run. Time is banked plus a start stamp, never a ticking
 *  counter, so a reload or a second screen reads the same clock. */
export interface HeatLane {
  elapsedMs: number;
  startedAt: number | null;
  counts: Record<string, number>;
}

export interface LiveEffect {
  key: string;
  teamId: string;
  penaltyId: string;
  startAt: number;
  sec: number;
}

export interface GameState {
  mode: 'single' | 'h2h' | 'all';
  h2hPick: string[];
  lanes: Record<string, HeatLane>;
  solo: { mode: 'up' | 'down'; targetSec: number; elapsedMs: number; startedAt: number | null };
  effects: LiveEffect[];
}

export interface TonightState {
  date: string;
  presence: Record<string, boolean>;
  /** How each present student got in: the door QR / kiosk, or a leader's tap. */
  via: Record<string, CheckinVia>;
  checkinDetail: Record<string, { pts: number; count: number; picks: Record<string, boolean>; visitors: string }>;
  /** 'posted' | 'held' | {count, held} — HOW it completed, never a bare boolean. */
  checkinPosted: Record<string, 'posted' | 'held' | { count: number; held: boolean }>;
  goals: Record<string, number>;
  pushed: Record<string, 'posted' | 'held'>;
  heatPosted: 'posted' | 'held' | null;
}

export interface BracketData {
  enabled: boolean;
  seeds: string[];
  winners: Record<string, string>;
  liveSeed: boolean;
  paid: Record<string, string>;
}

/** Everything about one ministry. Persisted as one snapshot in demo mode;
 *  loaded from Supabase tables otherwise. */
export interface MinistryData {
  config: MinistryConfig;
  teams: Team[];
  cats: Category[];
  roster: Student[];
  ledger: LedgerEntry[];
  /** Demo only: points a student carried in before the ledger began. */
  studentSeedPoints: Record<string, number>;
  prayers: PrayerRequest[];
  prayerQueue: PrayerQueued[];
  careReminders: CareReminder[];
  events: MinistryEvent[];
  challenges: Challenge[];
  accessRequests: AccessRequest[];
  activityLog: ActivityLine[];
  huddle: HuddleState;
  visitorLog: VisitorLogRow[];
  verseLog: VerseLogRow[];
  achievements: Achievement[];
  studentBadges: StudentBadge[];
  smallGroups: SmallGroup[];
  deepSubs: DeepSubmission[];
  awards: Award[];
  library: LibraryUnit[];
  libraryPlaced: LibraryPlacement[];
  /** My votes: award → period ('season' | day | week) → choice. */
  awardVotes: Record<string, Record<string, string>>;
  /** Leaders: this period's tally per award → choice → votes. */
  awardTallies?: Record<string, Record<string, number>>;
  media: MediaItem[];
  clips: Clip[];
  filmMarks: FilmMark[];
  chatThreads: ChatThread[];
  chatMsgs: Record<string, ChatMessage[]>;
  chatUnread: Record<string, number>;
  rsvps: Record<string, Record<string, Rsvp>>;
  /** Supabase: head counts from rsvp_counts(), for roles that can't read names. */
  rsvpCounts?: Record<string, RsvpCount>;
  attendanceHistory: Record<string, number[]>;
  practiceLog: PracticeRow[];
  tonight: TonightState;
  game: GameState;
  bracket: BracketData;
  challengeCredit: Record<string, string[]>;
  /** Supabase, leaders only: everyone with a membership, for the Console. */
  people?: PersonRow[];
  /** Supabase: who you can start a direct message with. */
  chatDirectory?: import('@/lib/chat-dm').DirectoryEntry[];
  /** Who was present on each past meeting night (iso → names). Tonight is
   *  tonight.presence; this is the history the recap reads. */
  presenceLog: Record<string, string[]>;
  /** Per meeting night (iso): reminders, follow-ups, notes, pickup. */
  cycle: Record<string, NightCycle>;
  serving: ServingState;
  /** Guardian and private family link, per student name. Roster editors only. */
  families: Record<string, Family>;
  slips: PermissionSlip[];
  /** `${slipId}|${student}` → who signed and when. */
  slipSigned: Record<string, { by: string; at: number }>;
  parentMsgs: ParentMessage[];
  /** Season interviews, saved. One is the live season. */
  seasons: SavedSeason[];
  /** Reports the pastor built: what it reads, columns, filters, grouping, order. */
  customReports: CustomReport[];
  /** The delivery schedule — which report goes to whom, when. */
  deliveries: Delivery[];
  /** Deliveries sent by hand ("Send now"), newest first. */
  reportSendLog: { id: string; delivery: string; period: string; at: number; by: string }[];
  /** Supabase: what the server emailed, newest first (report_sends; leaders only). */
  /** Planning Center, as this person may see it: leaders get what it's
   *  connected to; coaches only whether it is. Absent in the demo. */
  pco?: { connected: boolean; org?: string; at?: number } | null;
  reportEmails?: { delivery: string; period: string; at: number; status: 'sending' | 'sent' | 'failed' | 'skipped'; sent: number; missing: string[]; error: string | null; by: string }[];
  /** The seven-year plan: lanes, seasons, items, gathering plans. */
  plan: Plan;
}

/* ── reports ─────────────────────────────────────────────────────────── */
export type ReportFieldKind = 'text' | 'num' | 'enum';

export interface ReportFilter {
  field: string;
  op: string;
  value: string;
}

export interface CustomReport {
  id: string;
  name: string;
  source: string;
  columns: string[];
  filters: ReportFilter[];
  groupBy: string | null;
  sort: { field: string; dir: 'asc' | 'desc' } | null;
  at: number;
}

export type DeliveryAudience = 'coaches' | 'captains' | 'squadLeads' | 'leaders' | 'staff';

export interface Delivery {
  id: string;
  /** A built-in report id or a custom report's id. */
  report: string;
  audience: DeliveryAudience;
  /** 'own': each squad gets its own copy. 'all': one copy of everything. */
  scope: 'own' | 'all';
  cadence: 'weekly' | 'nightAfter' | 'monthly';
  /** Day of the week (0 = Sunday) for weekly; day of the month for monthly. */
  day: number;
  time: string;
  on: boolean;
}

/* ── The week around the night ──────────────────────────────────────────
   Prep reminders before it, attendance during it, follow-ups after it,
   the volunteer schedule around it, and what families see. */
/** How someone was checked in: the door QR, a leader's tap, or Planning Center Check-Ins. */
export type CheckinVia = 'qr' | 'leader' | 'pco';
export type ReminderAudience = 'leaders' | 'parents';

export interface ReminderDef {
  id: string;
  /** "3 days out" */
  label: string;
  /** Days before the meeting night it goes out, at `time` (24h "HH:MM"). */
  days: number;
  time: string;
  /** When above zero: minutes before setup instead of days/time. */
  beforeMin: number;
  aud: ReminderAudience[];
  /** A template: {week} {game} {setup} {doors} {pickup} {place} {ministry} {day}. */
  text: string;
}

export interface CycleConfig {
  /** 24h "HH:MM" on the meeting night. Setup is when the crew arrives. */
  setupAt: string;
  doorsAt: string;
  endAt: string;
  pickupAt: string;
  pickupPlace: string;
  /** Follow-ups are due this long after the night wraps. */
  followupHours: number;
  /** Self check-in opens this many minutes before doors. */
  checkinOpensMin: number;
  serveRoles: string[];
  reminders: ReminderDef[];
}

export interface NightCycle {
  rem: Record<string, { off?: boolean; sentAt?: number; text?: string }>;
  fu: Record<string, { done?: boolean; at?: number; text?: string; by?: string }>;
  notes: { well: string; change: string };
  /** Minutes the pickup time moved tonight (+ later, − earlier). */
  pickupShift: number;
  /** Someone at the door who isn't on any roster — a leader goes over. */
  doorFlags: { id: string; name: string; at: number; done?: boolean }[];
}

export interface SwapRequest {
  id: string;
  from: string;
  night: string;
  role: string;
  /** Who they propose, or null for "anyone". */
  to: string | null;
  why: string;
  status: 'pending' | 'approved' | 'declined';
  at: number;
  decidedBy?: string;
}

export interface VolunteerInvite {
  id: string;
  name: string;
  contact: string;
  role: string;
  status: 'sent' | 'accepted';
  at: number;
}

export interface ServingState {
  /** `${iso}|${role}` → who serves, or null for an open spot. */
  sched: Record<string, string | null>;
  /** `${name}|${iso}` → in or away. Missing means not said. */
  avail: Record<string, 'yes' | 'no'>;
  swaps: SwapRequest[];
  invites: VolunteerInvite[];
}

export interface Family {
  guardian: string;
  contact: string;
  /** The private family link (/f/<token>). Rotating it revokes the old one. */
  token: string;
}

export interface PermissionSlip {
  id: string;
  title: string;
  /** Local "YYYY-MM-DDTHH:MM" the slip is due. */
  due: string;
  /** Everyone, or the students it covers. */
  kids: 'all' | string[];
  at: number;
}

export interface ParentMessage {
  id: string;
  from: string;
  /** 'all' · 'slip:<id>' · 'unsigned:<id>' · a student's name. */
  to: string;
  /** Resolved when sent, so a later roster change can't widen who got it. */
  kids: string[];
  text: string;
  at: number;
  /** student → read at */
  reads: Record<string, number>;
}

/** A person with a role in the ministry (leaders see the list). */
export interface PersonRow {
  id: string;
  name: string;
  role: MembershipRole;
  teamId: string | null;
  studentName: string | null;
}

/** Who is signed in, as the server resolved it. */
export interface Membership {
  mode: 'demo' | 'supabase';
  persona: Persona;
  role: MembershipRole | null;
  displayName: string;
  firstName: string;
  initials: string;
  membershipId: string | null;
  orgId: string | null;
  /** The squad this person belongs to or coaches, when they have one. */
  teamId: string | null;
  /** For a student: their roster name. For a parent: the student they watch. */
  studentName: string | null;
}
