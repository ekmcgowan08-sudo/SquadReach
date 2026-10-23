/* ─────────────────────────────────────────────────────────────────────────
   Roles and permission constants. SINGLE SOURCE OF TRUTH.

   Every permission decision in the app — the tab bar, the More index, each
   route's gate and the database's row-level security — reads these arrays.
   Do not introduce a parallel "tier" concept: the design prototype had one
   (full / staff / student / outsider) purely so a designer could flip between
   views, and it is not part of the data model.

   The same five arrays are mirrored in SQL (supabase/migrations, the
   role_in() helper calls). Change one, change both.
   ───────────────────────────────────────────────────────────────────────── */

export const MEMBERSHIP_ROLES = ['member', 'captain', 'coach', 'scorekeeper', 'leader', 'owner'] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export type ScoreEntryStatus = 'pending' | 'approved' | 'rejected';

export const ROLE_LABELS: Record<MembershipRole, string> = {
  member: 'Team Member',
  captain: 'Captain',
  coach: 'Coach',
  scorekeeper: 'Scorekeeper',
  leader: 'Ministry Leader',
  owner: 'Organization Owner'
};

/** Seasons, people, audit log, approving the queue. */
export const LEADER_ROLES: readonly MembershipRole[] = ['leader', 'owner'];

/** Roster edits AND Team Care. Excludes scorekeeper: that role owns the ledger, not the roster. */
export const ROSTER_EDIT_ROLES: readonly MembershipRole[] = ['coach', 'leader', 'owner'];

/** Who may open "Score a squad" at all — and who gets the huddle. */
export const SCORE_ENTRY_ROLES: readonly MembershipRole[] = ['coach', 'scorekeeper', 'leader', 'owner'];

/**
 * Whose submissions post as already-approved. A scorekeeper is the
 * authoritative ledger during a live event, so they never queue. Coaches
 * always queue. Getting this backwards is the easiest bug to ship — do not
 * re-derive it from anything else.
 */
export const AUTO_APPROVE_ROLES: readonly MembershipRole[] = ['scorekeeper', 'leader', 'owner'];

/** Competition, game timer, projector mode. Excludes coach on purpose. */
export const EVENT_CONTROL_ROLES: readonly MembershipRole[] = ['scorekeeper', 'leader', 'owner'];

/**
 * Who may move the 6:15 run sheet forward. Decided in review: coaches may
 * move it as well. The game timer and projector stay on EVENT_CONTROL_ROLES.
 */
export const SHEET_ROLES: readonly MembershipRole[] = [...EVENT_CONTROL_ROLES, 'coach'];

export function roleIn(role: MembershipRole | null | undefined, list: readonly MembershipRole[]): boolean {
  return !!role && list.includes(role);
}

/* ─────────────────────────────────────────────────────────────────────────
   Personas — who you are looking at the app as.

   Six of the eight are real MembershipRoles. PARENT and CONGREGATION are a
   design proposal for a read-only audience and DO NOT EXIST in the schema:
   adding them is a migration plus an RLS review, not a UI branch. They are
   reachable in demo mode only, and the role sheet labels them so nobody
   builds against them by accident.
   ───────────────────────────────────────────────────────────────────────── */

export type Persona = MembershipRole | 'parent' | 'congregation';

export interface PersonaDef {
  id: Persona;
  label: string;
  /** The real MembershipRole, or null for the two proposal personas. */
  maps: MembershipRole | null;
  icon: string;
  emoji: string;
}

export const PERSONAS: readonly PersonaDef[] = [
  { id: 'leader', label: 'Ministry Leader', maps: 'leader', icon: 'ph-fill ph-crown-simple', emoji: '🙏' },
  { id: 'owner', label: 'Organization Owner', maps: 'owner', icon: 'ph ph-buildings', emoji: '🏢' },
  { id: 'scorekeeper', label: 'Scorekeeper', maps: 'scorekeeper', icon: 'ph ph-clipboard-text', emoji: '📋' },
  { id: 'coach', label: 'Coach', maps: 'coach', icon: 'ph ph-megaphone-simple', emoji: '📣' },
  { id: 'captain', label: 'Captain', maps: 'captain', icon: 'ph ph-flag', emoji: '🚩' },
  { id: 'member', label: 'Team Member', maps: 'member', icon: 'ph ph-student', emoji: '🎓' },
  { id: 'parent', label: 'Parent', maps: null, icon: 'ph ph-users', emoji: '👪' },
  { id: 'congregation', label: 'Congregation', maps: null, icon: 'ph ph-church', emoji: '⛪' }
];

export function personaDef(id: Persona): PersonaDef {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
}

export function realRole(p: Persona | null | undefined): MembershipRole | null {
  return p ? personaDef(p).maps : null;
}

export function isPersona(v: unknown): v is Persona {
  return typeof v === 'string' && PERSONAS.some((p) => p.id === v);
}
