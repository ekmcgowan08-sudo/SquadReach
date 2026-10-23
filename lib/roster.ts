/* Roster import: one student per line, as a spreadsheet or a Planning Center
   export pastes. Pure, so it is tested on its own. */
import type { Student } from '@/lib/types/model';

/** "Name, grade, squad" per line — a paste from Planning Center or a sheet. */
export function parseRoster(text: string, teams: { id: string; name: string }[]): { rows: Student[]; skipped: string[] } {
  const rows: Student[] = [];
  const skipped: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^name\b/i.test(line)) continue;
    const parts = line.split(/\t|,/).map((x) => x.trim());
    const name = parts[0]?.replace(/^"|"$/g, '');
    if (!name || name.length < 2) {
      skipped.push(line);
      continue;
    }
    const grade = (parts[1] ?? '').replace(/[^0-9a-zA-Z]/g, '');
    const squad = (parts[2] ?? '').toLowerCase();
    const team = teams.find((t) => t.name.toLowerCase() === squad || t.id === squad)?.id ?? null;
    rows.push({ id: crypto.randomUUID(), name, grade, team });
  }
  return { rows, skipped };
}
