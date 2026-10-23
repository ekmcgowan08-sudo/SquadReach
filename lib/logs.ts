/* The visitor log and the verse log, rebuilt from the ledger. Every
   check-in that brings a friend or recites a verse is a points entry whose
   detail carries the names and the count — and the ledger already goes
   through the offline outbox and syncs row by row. So with accounts the
   logs are read back from it rather than kept as a second copy that could
   disagree (or be lost when two coaches post at once). A reversed or
   rejected entry drops out of the logs with its points. */
import { isoDay, weekOf } from '@/lib/dates';
import type { LedgerEntry, VerseLogRow, VisitorLogRow } from '@/lib/types/model';

export function logsFromLedger(ledger: LedgerEntry[], meetingDates: string[]): { visitorLog: VisitorLogRow[]; verseLog: VerseLogRow[] } {
  const reversed = new Set(ledger.filter((e) => e.reverses).map((e) => e.reverses as string));
  const live = ledger.filter((e) => !e.reverses && !reversed.has(e.id) && e.status !== 'rejected' && e.student).sort((a, b) => b.at - a.at);
  const week = (at: number) => weekOf(meetingDates, isoDay(new Date(at)));
  const visitorLog: VisitorLogRow[] = [];
  const verseLog: VerseLogRow[] = [];
  for (const e of live) {
    const det = e.detail;
    if (!det) continue;
    if (e.cat === 'visitors' && det.friends?.length)
      visitorLog.push({ id: e.id, names: det.friends, student: e.student!, team: e.team, week: week(e.at), kind: det.friendKind ?? 'new', at: e.at });
    if (det.verses)
      verseLog.push({ id: e.id, student: e.student!, team: e.team, week: week(e.at), set: det.verseSet ?? 'week', label: det.verseSet === 'sunday' ? 'Sunday verse' : 'Week verse', count: det.verses, pts: e.amount });
  }
  return { visitorLog, verseLog };
}
