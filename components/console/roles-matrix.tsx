'use client';
/* Who can do what — read straight off lib/permissions.ts, the same
   functions every menu row, screen gate and (by its role lists) RLS policy
   uses, so this table can't drift from what the app actually allows. */
import { Section } from '@/components/console/kit';
import { Icon } from '@/components/ui';
import {
  autoApproves, canApprove, canControlEvent, canCoordinateServing, canEditRoster, canHuddle, canMessageParents, canNightRecap, canOpenLibrary,
  canPrepWeek, canPublishBoard, canReviewPrayer, canRunDoor, canRunLive, canScore, canSeeAttendance, canServe, canShareRecap
} from '@/lib/permissions';
import { PERSONAS, realRole, type Persona } from '@/lib/types/domain';

const ROWS: { label: string; gate: string; can: (p: Persona) => boolean }[] = [
  { label: 'Enter points', gate: 'SCORE_ENTRY_ROLES', can: canScore },
  { label: 'Points post with no review', gate: 'AUTO_APPROVE_ROLES', can: autoApproves },
  { label: 'Approve points, people and access', gate: 'LEADER_ROLES', can: canApprove },
  { label: 'Read prayer requests before the wall', gate: 'LEADER_ROLES', can: canReviewPrayer },
  { label: 'Edit the roster and check people in', gate: 'ROSTER_EDIT_ROLES', can: canEditRoster },
  { label: 'See attendance and share the recap', gate: 'ROSTER_EDIT_ROLES', can: (p) => canSeeAttendance(p) && canShareRecap(p) },
  { label: 'Run the door kiosk', gate: 'ROSTER_EDIT_ROLES', can: canRunDoor },
  { label: 'Night recap and follow-ups', gate: 'ROSTER_EDIT_ROLES', can: canNightRecap },
  { label: 'Huddle and run sheet', gate: 'SCORE_ENTRY_ROLES', can: canHuddle },
  { label: 'Game timer and projector', gate: 'EVENT_CONTROL_ROLES', can: canControlEvent },
  { label: 'Serve and ask for swaps', gate: 'SCORE_ENTRY_ROLES', can: canServe },
  { label: 'Coordinate serving and approve swaps', gate: 'LEADER_ROLES', can: canCoordinateServing },
  { label: 'Prep the week', gate: 'LEADER_ROLES', can: canPrepWeek },
  { label: 'Message parents and send slips', gate: 'LEADER_ROLES', can: canMessageParents },
  { label: 'Run live ministry time', gate: 'LEADER_ROLES', can: canRunLive },
  { label: 'Open the curriculum library', gate: 'SCORE_ENTRY_ROLES', can: canOpenLibrary },
  { label: 'Publish the parent board link', gate: 'LEADER_ROLES', can: canPublishBoard },
  { label: 'The console and the planner', gate: 'LEADER_ROLES', can: canApprove }
];

export function RolesMatrix() {
  const cols = PERSONAS.filter((p) => realRole(p.id));
  return (
    <Section title="Who can do what" sub="Read off the same checks the app and the database use. Owners are the only ones who can make another owner.">
      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr>
              <th className="px-3 py-2 text-[11px] font-normal text-neutral-500">Capability</th>
              {cols.map((c) => (
                <th key={c.id} className="border-l border-neutral-800 px-2 py-2 text-center text-[11.5px] font-medium text-neutral-200">
                  {c.label.replace('Organization ', '').replace('Ministry ', '').replace('Team ', '')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.label} className="border-t border-neutral-800">
                <td className="px-3 py-[7px]">
                  <div className="text-[12.5px] text-neutral-100">{r.label}</div>
                  <div className="font-mono text-[10px] text-neutral-500">{r.gate}</div>
                </td>
                {cols.map((c) => (
                  <td key={c.id} className="border-l border-neutral-800 text-center">
                    {r.can(c.id) ? <Icon name="ph-fill ph-check-circle" className="text-[15px] text-accent-300" /> : <span className="text-neutral-700">·</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-[12px] leading-[1.6] text-neutral-500">
        Chat: everyone reads the announcements and the volunteer set posts there; the volunteers’ thread is just the volunteer set; a squad thread is that squad plus the volunteer set. Adults can message each other privately. Any thread with a student in it is an open door — leaders can read it, not post in it — and students can’t message each other. Parents use their family link; they hold no account.
      </div>
    </Section>
  );
}
