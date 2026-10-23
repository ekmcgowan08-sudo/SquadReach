/* The one seam between the app and where its data lives.

   DEMO mode keeps the whole ministry on this device (a snapshot in
   localStorage). SUPABASE mode reads the ministry from the database and
   writes each change back as it happens; row-level security decides what
   any given role can read or write, using the same constants as the UI.

   The store never knows which one it is talking to. */
import type { ScoreEntryStatus } from '@/lib/types/domain';
import type {
  AccessRequest, ActivityLine, CareReminder, Category, ChatMessage, CheckinVia, Family, HuddleState, LedgerEntry, MinistryConfig,
  GameState, LibraryUnit, NightCycle, ParentMessage, PermissionSlip, PersonRow, MediaItem, MinistryData, MinistryEvent, PracticeRow,
  PrayerQueued, Rsvp, RsvpCount, Student, SwapRequest, Team, VolunteerInvite
} from '@/lib/types/model';

export type SyncEvent =
  | { kind: 'activity'; line: ActivityLine }
  | { kind: 'prayerSubmit'; item: PrayerQueued; anonymous: boolean }
  | { kind: 'prayerPost'; ids: string[] }
  | { kind: 'prayerHold'; id: string }
  | { kind: 'prayerPraying'; id: string; on: boolean }
  | { kind: 'prayerAnswered'; id: string; on: boolean }
  | { kind: 'careAdd'; item: CareReminder }
  | { kind: 'careDone'; id: string }
  | { kind: 'accessDecide'; request: AccessRequest; approve: boolean }
  | { kind: 'huddle'; huddle: HuddleState }
  | { kind: 'config'; config: MinistryConfig }
  | { kind: 'team'; team: Team }
  | { kind: 'teamRemove'; id: string }
  | { kind: 'category'; cat: Category; sort: number }
  | { kind: 'categoryRemove'; id: string }
  | { kind: 'student'; student: Student }
  | { kind: 'presence'; date: string; student: string; present: boolean; via?: CheckinVia }
  | { kind: 'chat'; threadId: string; msg: ChatMessage }
  | { kind: 'rsvp'; eventId: string; name: string; rec: Rsvp }
  | { kind: 'practice'; row: PracticeRow }
  | { kind: 'game'; game: GameState }
  /** A leader-curated document (small groups, awards, logs) saved whole. */
  | { kind: 'doc'; key: 'smallGroups' | 'awards' | 'visitorLog' | 'verseLog' | 'libraryPlaced'; value: unknown }
  | { kind: 'libraryShare'; unit: LibraryUnit }
  /** A photo or video filed into a week album; the file uploads with it. */
  | { kind: 'media'; item: MediaItem; file: Blob }
  | { kind: 'mediaRemove'; id: string; path: string | null }
  | { kind: 'vote'; awardId: string; period: string; choice: string }
  | { kind: 'nominee'; awardId: string; id: string; name: string }
  | { kind: 'event'; event: MinistryEvent }
  | { kind: 'eventRemove'; id: string }
  | { kind: 'studentRemove'; id: string }
  | { kind: 'person'; person: PersonRow }
  | { kind: 'personRemove'; id: string }
  | { kind: 'rotateInvite' }
  /* The week around the night. */
  | { kind: 'reminder'; date: string; id: string; rec: NightCycle['rem'][string] }
  | { kind: 'followup'; date: string; id: string; rec: NightCycle['fu'][string] }
  | { kind: 'nightNotes'; date: string; notes: NightCycle['notes'] }
  | { kind: 'pickup'; date: string; shift: number }
  | { kind: 'doorFlag'; date: string; flag: NightCycle['doorFlags'][number] }
  | { kind: 'serve'; night: string; role: string; name: string | null }
  | { kind: 'avail'; name: string; night: string; state: 'yes' | 'no' | null }
  | { kind: 'swap'; swap: SwapRequest }
  | { kind: 'invite'; invite: VolunteerInvite }
  | { kind: 'family'; student: string; family: Family }
  | { kind: 'slip'; slip: PermissionSlip }
  | { kind: 'slipRemove'; id: string }
  | { kind: 'slipSign'; slip: string; student: string; by: string | null }
  | { kind: 'parentMsg'; msg: ParentMessage }
  /** A student checks themselves in (RPC: only their own row, only tonight). */
  | { kind: 'selfCheckin'; date: string };

/** A change that arrived from someone else's phone. */
export type RemotePatch =
  | { kind: 'entries'; entries: LedgerEntry[] }
  | { kind: 'huddle'; huddle: HuddleState }
  | { kind: 'game'; game: GameState }
  | { kind: 'chat'; threadId: string; msg: ChatMessage }
  | { kind: 'rsvp'; eventId: string; name: string; rec: Rsvp; counts?: Record<string, RsvpCount> }
  | { kind: 'reload' };

export interface Backend {
  mode: 'demo' | 'supabase';
  load(): Promise<MinistryData>;
  /** Demo: persist the whole snapshot. Supabase: no-op (each change syncs). */
  saveSnapshot(d: MinistryData): void;
  /** Idempotent on entry.id — the client-generated uuid. Rejects when the
   *  network does, so the caller can keep the entries held. */
  pushEntries(entries: LedgerEntry[]): Promise<void>;
  decideEntries(ids: string[], status: ScoreEntryStatus, by: string): Promise<void>;
  sync(event: SyncEvent): Promise<void>;
  /** A short-lived URL for a stored file, or null where files stay on the phone. */
  fileUrl(path: string): Promise<string | null>;
  subscribe(onRemote: (patch: RemotePatch) => void): () => void;
}

