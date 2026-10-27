/* When a vote award takes votes. A leader can close voting by hand, and
   can schedule a window: voting opens on the start day and closes after
   the end day. The database checks the same rule (award_vote_open). */
import type { Award } from '@/lib/types/model';

type Window = Pick<Award, 'votingOpen' | 'votingStartDate' | 'votingEndDate'>;

export function awardOpen(a: Window, today: string): boolean {
  if (!a.votingOpen) return false;
  if (a.votingStartDate && today < a.votingStartDate) return false;
  if (a.votingEndDate && today > a.votingEndDate) return false;
  return true;
}

const day = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** "Open · closes Nov 4", "Scheduled · starts Nov 1", "Closed · ended Oct 20"… */
export function awardStatus(a: Window, today: string): string {
  if (!a.votingOpen) return 'Closed · by hand';
  if (a.votingStartDate && today < a.votingStartDate) return 'Scheduled · starts ' + day(a.votingStartDate);
  if (a.votingEndDate && today > a.votingEndDate) return 'Closed · ended ' + day(a.votingEndDate);
  if (a.votingEndDate) return 'Open · closes after ' + day(a.votingEndDate);
  return 'Open';
}
