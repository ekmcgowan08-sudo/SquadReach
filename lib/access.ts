/* How an access request reads once it's decided, the same on the phone and
   in the console: what they were let in as, by whom, and when. */
import { personaDef } from '@/lib/types/domain';
import type { AccessRequest } from '@/lib/types/model';

export function decisionLine(r: AccessRequest): string {
  if (r.status === 'pending') return '';
  const changed = !!r.grantedRole && r.grantedRole !== r.requestedRole;
  const head =
    r.status === 'approved'
      ? 'Approved as ' + personaDef(r.grantedRole ?? r.requestedRole).label + (changed ? ' (asked for ' + personaDef(r.requestedRole).label + ')' : '')
      : 'Denied · asked for ' + personaDef(r.requestedRole).label;
  const when = r.decidedAt ? ' · ' + new Date(r.decidedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  return head + (r.decidedBy ? ' by ' + r.decidedBy : '') + when;
}

/** Decided requests, newest decision first. */
export const decidedRequests = (list: AccessRequest[], n: number) =>
  list
    .filter((r) => r.status !== 'pending')
    .sort((a, b) => (b.decidedAt ?? b.at) - (a.decidedAt ?? a.at))
    .slice(0, n);
