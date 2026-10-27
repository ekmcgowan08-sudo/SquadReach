/* Corrections after the night's report. Leader reports go out the moment
   the night is closed; an undo after that changes numbers people already
   have, so it comes with a short correction notice. Nothing is stored for
   it — a correction is a reversal posted after the close, of an entry from
   before it, read straight off the ledger. */
import { fmt, signed } from '@/lib/scoring';
import type { MinistryData } from '@/lib/types/model';

export interface Correction {
  id: string;
  at: number;
  team: string;
  cat: string;
  /** The reversal's amount: the opposite of what the report showed. */
  amount: number;
  line: string;
}

export function corrections(d: MinistryData): Correction[] {
  const closed = d.huddle.closedAt;
  if (!d.huddle.nightClosed || !closed) return [];
  const byId = new Map(d.ledger.map((e) => [e.id, e]));
  const out: Correction[] = [];
  for (const r of d.ledger) {
    if (!r.reverses || r.status !== 'approved' || r.at <= closed) continue;
    const orig = byId.get(r.reverses);
    if (!orig || orig.at > closed || orig.status !== 'approved') continue;
    const team = d.teams.find((t) => t.id === r.team)?.name ?? 'A squad';
    const cat = d.cats.find((c) => c.id === r.cat)?.label ?? r.cat;
    out.push({ id: r.id, at: r.at, team: r.team, cat: r.cat, amount: r.amount, line: team + ' ' + signed(r.amount) + ' ' + cat + ' — ' + fmt(Math.abs(r.amount)) + ' from the night’s report was taken back' });
  }
  return out.sort((a, b) => b.at - a.at);
}
