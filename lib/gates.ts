/* Named gates, so a server page and its client screen check the SAME
   function by name (functions cannot cross the server/client boundary). */
import {
  canApprove, canControlEvent, canHuddle, canOpenLibrary, canOpenRoleView, canPublishBoard, canScore, canSeeAttendance,
  canShareRecap
} from '@/lib/permissions';
import { realRole, type Persona } from '@/lib/types/domain';

export const GATES = {
  any: () => true,
  member: (p: Persona) => !!realRole(p),
  score: canScore,
  submit: (p: Persona) => canScore(p) || p === 'captain',
  approve: canApprove,
  huddle: canHuddle,
  event: canControlEvent,
  library: canOpenLibrary,
  attendance: canSeeAttendance,
  recap: canShareRecap,
  board: canPublishBoard,
  coachView: (p: Persona) => canOpenRoleView(p, 'coach'),
  captainView: (p: Persona) => canOpenRoleView(p, 'captain'),
  adminView: (p: Persona) => canOpenRoleView(p, 'admin'),
  parentView: (p: Persona) => canOpenRoleView(p, 'parent'),
  congregationView: (p: Persona) => canOpenRoleView(p, 'congregation'),
  teamView: (p: Persona) => canOpenRoleView(p, 'team')
} satisfies Record<string, (p: Persona) => boolean>;

export type GateName = keyof typeof GATES;
