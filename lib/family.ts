/* The private family link (/f/<token>). Supabase returns only one
   student's rows through family_view(); this turns them back into the shape
   the shared view model reads, so the card is computed the same way
   everywhere. Nothing here can see another family. */
import { emptyNight, familyView, type FamilyView } from '@/lib/cycle';
import { tonightDate } from '@/lib/dates';
import { emptyMinistry } from '@/lib/data/empty';
import type { CycleConfig, NightCycle, RunSheetItem, CheckinVia, FormKind } from '@/lib/types/model';

export interface FamilyRaw {
  ministry: string;
  cycle: CycleConfig | null;
  meetingDates: string[];
  gameName: string;
  venueAddress: string;
  kid: { name: string; team: string | null; teamColor: string | null };
  guardian: string;
  crew: { name: string; job: string; team: string | null }[];
  runSheet: Pick<RunSheetItem, 'time' | 'label' | 'debrief'>[];
  tonight: string | null;
  present: boolean;
  via: CheckinVia | null;
  presentDates: string[];
  night: Partial<NightCycle> | null;
  slips: { id: string; title: string; due: string; kind?: FormKind }[];
  signed: { slip: string; by: string }[];
  msgs: { id: string; from: string; text: string; at: number; read: boolean }[];
}

export function familyFromRaw(raw: FamilyRaw, now: number): FamilyView | null {
  const d = emptyMinistry();
  const name = raw.kid.name;
  const iso = raw.tonight ?? tonightDate(raw.meetingDates, new Date(now));
  d.config = { ...d.config, ministryName: raw.ministry, meetingDates: raw.meetingDates, gameName: raw.gameName, venueAddress: raw.venueAddress, ...(raw.cycle ? { cycle: { ...d.config.cycle, ...raw.cycle } } : {}) };
  d.teams = raw.kid.team ? [{ id: 't', name: raw.kid.team, color: raw.kid.teamColor ?? '#968ae0', mascotName: '', mascotStory: '', sort: 0 }] : [];
  d.roster = [{ id: 'k', name, team: raw.kid.team ? 't' : null, grade: '' }];
  d.huddle.crew = raw.crew.map((c, i) => ({ id: 'c' + i, name: c.name, job: c.job, post: '', team: c.team === raw.kid.team && raw.kid.team ? 't' : null, sendHome: '' }));
  d.huddle.runSheet = raw.runSheet.map((r, i) => ({ id: 'r' + i, time: r.time, label: r.label, debrief: r.debrief, where: '', who: '', detail: '', assignedTo: null, notifiedAt: null }));
  d.tonight.date = iso;
  if (raw.present) {
    d.tonight.presence[name] = true;
    d.tonight.via[name] = raw.via ?? 'leader';
  }
  for (const day of raw.presentDates) d.presenceLog[day] = [name];
  d.cycle[iso] = { ...emptyNight(), ...(raw.night ?? {}) };
  d.slips = raw.slips.map((s) => ({ ...s, kids: [name], at: 0 }));
  for (const s of raw.signed) d.slipSigned[s.slip + '|' + name] = { by: s.by, at: 0 };
  d.parentMsgs = raw.msgs.map((m) => ({ id: m.id, from: m.from, to: name, kids: [name], text: m.text, at: m.at, reads: m.read ? { [name]: 1 } : {} }));
  d.families[name] = { guardian: raw.guardian, contact: '', token: '' };
  return familyView(d, name, now);
}
