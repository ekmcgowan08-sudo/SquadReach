/* The ministry's data, as the app holds it. Field names follow the design
   prototype's state on purpose, so behaviour can be diffed against it. The
   Supabase tables (supabase/migrations) map onto these one to one; see
   lib/data/supabase-backend.ts for the mapping. */
import type { MembershipRole, Persona, ScoreEntryStatus } from './domain';

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
  date: string;
  color: string;
  roles: AudienceId[];
}

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

export interface Award {
  id: string;
  name: string;
  description: string;
  decidedBy: 'score' | 'vote' | 'streak';
  categoryId?: string | null;
  recipientType?: 'team' | 'individual';
  votingOpen?: boolean;
  voteFrequency?: string;
  nominees?: { id: string; name: string }[];
  metric?: 'bible' | 'attendance';
}

export interface MediaItem {
  id: string;
  week: number;
  kind: 'photo' | 'video' | 'audio';
  label: string;
  /** Object URL / storage URL. Null for a placeholder slot. */
  url?: string | null;
  at: number;
}

export interface Clip {
  id: string;
  url: string;
  dur: number;
  at: number;
  /** "YEL 320 · BLU 275" — the game-points line burned into the scorebug. */
  line: string;
  mb: number;
  week: number;
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
}

export interface ChatMessage {
  id: string;
  day: string;
  time: string;
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

/** Tonight's floor: who is here and what has been posted. Presence is
 *  roster data (ROSTER_EDIT_ROLES), and posting it IS the scoring step. */
export interface TonightState {
  date: string;
  presence: Record<string, boolean>;
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
  awardVotes: Record<string, string>;
  media: MediaItem[];
  clips: Clip[];
  chatThreads: ChatThread[];
  chatMsgs: Record<string, ChatMessage[]>;
  chatUnread: Record<string, number>;
  rsvps: Record<string, Record<string, Rsvp>>;
  attendanceHistory: Record<string, number[]>;
  practiceLog: PracticeRow[];
  tonight: TonightState;
  bracket: BracketData;
  challengeCredit: Record<string, string[]>;
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
