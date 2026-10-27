/* Forms, trips and camp money — the design's decisions, as rules:

   · Medical & allergies, emergency contact, general permission and trip
     waivers block; a photo release only warns.
   · A blocked student still takes part tonight — a leader texts the parent
     from the door. The block gates trips, not tonight.
   · Camp money is tracking only, with no card handling. Any leader can mark
     a payment at the door; it stays unconfirmed until the office counts it. */
import { slipKids } from '@/lib/cycle';
import { FORM_KINDS, formKind } from '@/lib/form-kinds';
import type { MinistryData, MinistryEvent, PermissionSlip } from '@/lib/types/model';

export { FORM_KINDS, formKind };

/** A form counts for a trip if it stands for every trip or is that trip's own. */
const appliesTo = (s: PermissionSlip, eventId?: string | null) => !s.event || (!!eventId && s.event === eventId);

/** The unsigned forms a student has: the ones that block, and the ones that
 *  only warn. With an event, only the forms that count for that trip. */
export function missingForms(d: MinistryData, student: string, eventId?: string | null): { blocking: PermissionSlip[]; warning: PermissionSlip[] } {
  const blocking: PermissionSlip[] = [];
  const warning: PermissionSlip[] = [];
  for (const s of d.slips) {
    if (!appliesTo(s, eventId) || !slipKids(d, s).includes(student) || d.slipSigned[s.id + '|' + student]) continue;
    (formKind(s).blocks ? blocking : warning).push(s);
  }
  return { blocking, warning };
}

/** Why a student can't sign up for a trip yet, or null when they can. */
export function tripBlock(d: MinistryData, e: MinistryEvent, student: string | null | undefined): string | null {
  if (!e.trip || !student) return null;
  const { blocking } = missingForms(d, student, e.id);
  if (!blocking.length) return null;
  return 'Not signed yet: ' + blocking.map((s) => (s.kind === 'waiver' ? s.title : formKind(s).label)).join(', ') + '. A parent signs from the family link.';
}

export interface TripRow {
  name: string;
  team: string | null;
  going: boolean;
  blocking: PermissionSlip[];
  warning: PermissionSlip[];
  paid: number;
  unconfirmed: number;
}

/** Everyone a trip is for (or who said they're going), with their forms
 *  and money — blocked first, then by name. */
export function tripRoster(d: MinistryData, e: MinistryEvent): TripRow[] {
  const going = new Set(Object.entries(d.rsvps[e.id] ?? {}).filter(([, r]) => r.status === 'going').map(([n]) => n));
  const forStudents = e.roles.includes('members') || e.roles.includes('captains');
  const names = d.roster.filter((s) => !s.guest && (forStudents || going.has(s.name)));
  return names
    .map((s) => {
      const f = missingForms(d, s.name, e.id);
      const pays = d.payments.filter((p) => p.event === e.id && p.student === s.name);
      return {
        name: s.name,
        team: s.team,
        going: going.has(s.name),
        blocking: f.blocking,
        warning: f.warning,
        paid: pays.filter((p) => p.confirmedAt).reduce((n, p) => n + p.amount, 0),
        unconfirmed: pays.filter((p) => !p.confirmedAt).reduce((n, p) => n + p.amount, 0)
      };
    })
    .sort((a, b) => Number(b.blocking.length > 0) - Number(a.blocking.length > 0) || a.name.localeCompare(b.name));
}

/** Money on a trip: counted by the office, and marked but not yet counted. */
export function tripMoney(d: MinistryData, e: MinistryEvent) {
  const pays = d.payments.filter((p) => p.event === e.id);
  return {
    counted: pays.filter((p) => p.confirmedAt).reduce((n, p) => n + p.amount, 0),
    unconfirmed: pays.filter((p) => !p.confirmedAt).reduce((n, p) => n + p.amount, 0),
    waiting: pays.filter((p) => !p.confirmedAt)
  };
}

export const money = (n: number) => '$' + (Number.isInteger(n) ? String(n) : n.toFixed(2));

/** Here tonight with a blocking form unsigned: still in, and a leader texts
 *  the parent. Standing forms only — a trip's own waiver isn't tonight's. */
export function hereWithoutForms(d: MinistryData): { name: string; forms: PermissionSlip[] }[] {
  return Object.entries(d.tonight.presence)
    .filter(([, here]) => here)
    .map(([name]) => ({ name, forms: missingForms(d, name).blocking }))
    .filter((x) => x.forms.length);
}
