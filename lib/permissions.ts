/* Every gate in the app, as a named question. Each one reads a constant from
   lib/types/domain.ts — the menu row that shows a screen and the screen's own
   gate call the SAME function, so a deep link can never be the hole in it. */
import {
  AUTO_APPROVE_ROLES,
  EVENT_CONTROL_ROLES,
  LEADER_ROLES,
  ROSTER_EDIT_ROLES,
  SCORE_ENTRY_ROLES,
  SHEET_ROLES,
  realRole,
  roleIn,
  type Persona
} from '@/lib/types/domain';

const has = (p: Persona | null | undefined, list: Parameters<typeof roleIn>[1]) => roleIn(realRole(p), list);

/** Entries post as approved (no review queue). */
export const autoApproves = (p: Persona) => has(p, AUTO_APPROVE_ROLES);
/** The centre Score tab and the score pad. */
export const canScore = (p: Persona) => has(p, SCORE_ENTRY_ROLES);
/** Who may clear the approval queue, decide access, edit guides and awards. */
export const canApprove = (p: Persona) => has(p, LEADER_ROLES);
/** Team Care notes. Scorekeeper owns the ledger, not the roster. */
export const canSeeCare = (p: Persona) => has(p, ROSTER_EDIT_ROLES);
/** Mirrors prayer_read_queue: only LEADER_ROLES see requests before the wall. */
export const canReviewPrayer = (p: Persona) => has(p, LEADER_ROLES);
/** Roster edits and presence marks. */
export const canEditRoster = (p: Persona) => has(p, ROSTER_EDIT_ROLES);
/** Game timer and Projector Mode. Not a coach. */
export const canControlEvent = (p: Persona) => has(p, EVENT_CONTROL_ROLES);
/** The 6:15 huddle is the volunteer set. A captain is a student. */
export const canHuddle = (p: Persona) => has(p, SCORE_ENTRY_ROLES);
/** Who may move the run sheet forward. */
export const holdsSheet = (p: Persona) => has(p, SHEET_ROLES);
/** Attendance map and the recap card are roster work. */
export const canSeeAttendance = (p: Persona) => has(p, ROSTER_EDIT_ROLES);
export const canShareRecap = (p: Persona) => has(p, ROSTER_EDIT_ROLES);
/** A public board carries student names — a leader decision. */
export const canPublishBoard = (p: Persona) => has(p, LEADER_ROLES);
/** The library: volunteer-and-up reads, only leaders place. */
export const canOpenLibrary = (p: Persona) => has(p, SCORE_ENTRY_ROLES);

/* ── the week around the night ─────────────────────────────────────── */
/** Prep week: the reminders that go out and what must be ready. */
export const canPrepWeek = (p: Persona) => has(p, LEADER_ROLES);
/** Night recap: attendance, follow-ups, notes. Coaches own most follow-ups. */
export const canNightRecap = (p: Persona) => has(p, ROSTER_EDIT_ROLES);
/** Serving & swaps: anyone on the volunteer schedule. */
export const canServe = (p: Persona) => has(p, SCORE_ENTRY_ROLES);
/** Approving swaps, filling spots and inviting volunteers: the coordinator. */
export const canCoordinateServing = (p: Persona) => has(p, LEADER_ROLES);
/** Messaging families, slips, pickup — and every family's contact details. */
export const canMessageParents = (p: Persona) => has(p, LEADER_ROLES);
/** The door kiosk checks students in, so it is roster work. */
export const canRunDoor = (p: Persona) => has(p, ROSTER_EDIT_ROLES);
/** Mirrors live_rooms_write: leaders run ministry time; everyone answers. */
export const canRunLive = (p: Persona) => has(p, LEADER_ROLES);

/* ── Role views ───────────────────────────────────────────────────────── */
export type RoleView = 'coach' | 'captain' | 'admin' | 'parent' | 'congregation' | 'team';

export function canOpenRoleView(p: Persona, view: RoleView): boolean {
  switch (view) {
    case 'coach':
      return has(p, ROSTER_EDIT_ROLES);
    case 'captain':
      return has(p, ['captain']) || has(p, LEADER_ROLES);
    case 'admin':
      return has(p, LEADER_ROLES);
    case 'parent':
      return p === 'parent' || has(p, LEADER_ROLES);
    case 'congregation':
      return true;
    case 'team':
      return !!realRole(p);
  }
}

/** Team view may switch squads: roster editors and the scorekeeper. */
export const canSwitchTeamView = (p: Persona) => has(p, ROSTER_EDIT_ROLES) || has(p, ['scorekeeper']);

/** Is this persona looking at a view that belongs to someone else? */
export function isPreviewing(p: Persona, view: RoleView): boolean {
  if (view === 'captain') return p !== 'captain';
  if (view === 'admin') return p !== 'owner';
  if (view === 'parent') return p !== 'parent';
  if (view === 'congregation') return p !== 'congregation';
  return false;
}
