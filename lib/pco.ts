/* Planning Center, read the way the app needs it. Pure: what comes back
   from the People and Check-Ins APIs (JSON:API documents) turned into
   roster rows and names, so it is tested without a network. The calls
   themselves are on the server (lib/server/pco.ts). */
import type { Student } from '@/lib/types/model';

export interface PcoPerson {
  id: string;
  name: string;
  /** '' when Planning Center has no grade; 'K' for kindergarten. */
  grade: string;
  child: boolean;
  active: boolean;
}

interface JsonApiDoc<A> {
  data: { id: string; type: string; attributes: A }[] | { id: string; type: string; attributes: A };
  links?: { next?: string };
  included?: { id: string; type: string; attributes: Record<string, unknown> }[];
}

/** Planning Center grades: -1 pre-K, 0 kindergarten, 1–12. */
export function gradeOf(g: unknown): string {
  if (typeof g !== 'number' || !Number.isFinite(g)) return '';
  if (g < 0) return 'PK';
  if (g === 0) return 'K';
  return String(Math.min(12, Math.round(g)));
}

type PersonAttrs = { first_name?: string | null; last_name?: string | null; name?: string | null; nickname?: string | null; grade?: number | null; child?: boolean; status?: string | null };

export function peopleFrom(doc: JsonApiDoc<PersonAttrs>): PcoPerson[] {
  const rows = Array.isArray(doc.data) ? doc.data : [doc.data];
  return rows
    .filter((r) => r.type === 'Person')
    .map((r) => {
      const a = r.attributes;
      const name = ([a.first_name, a.last_name].filter(Boolean).join(' ') || a.name || '').trim().replace(/\s+/g, ' ');
      return { id: r.id, name, grade: gradeOf(a.grade), child: !!a.child, active: (a.status ?? 'active') === 'active' };
    })
    .filter((p) => p.name.length > 1);
}

/** Students for this ministry: active, and either in the grades it serves
 *  or (when Planning Center has no grade) marked as a child. */
export function studentsOnly(people: PcoPerson[], grades: { from: number; to: number } = { from: 6, to: 12 }): PcoPerson[] {
  return people.filter((p) => {
    if (!p.active) return false;
    const n = Number(p.grade);
    return p.grade && Number.isFinite(n) ? n >= grades.from && n <= grades.to : false;
  });
}

const key = (n: string) => n.trim().toLowerCase().replace(/\s+/g, ' ');

/** What an import would add: everyone not already on the roster by name,
 *  unassigned to a squad (a coach places them). */
export function importPreview(people: PcoPerson[], roster: { name: string }[]): { add: Student[]; already: string[] } {
  const have = new Set(roster.map((r) => key(r.name)));
  const seen = new Set<string>();
  const add: Student[] = [];
  const already: string[] = [];
  for (const p of people) {
    if (seen.has(key(p.name))) continue;
    seen.add(key(p.name));
    if (have.has(key(p.name))) {
      already.push(p.name);
      continue;
    }
    add.push({ id: crypto.randomUUID(), name: p.name, grade: p.grade, team: null });
  }
  return { add, already };
}

type CheckInAttrs = { first_name?: string | null; last_name?: string | null; kind?: string | null; checked_out_at?: string | null; created_at?: string };
export interface CheckInDoc {
  data: { id: string; type: string; attributes: CheckInAttrs }[];
  links?: { next?: string };
}

/** Names checked in, from a Check-Ins page. Volunteers' check-ins aren't
 *  student attendance, so only regular and guest check-ins count. */
export function checkInNames(doc: CheckInDoc | JsonApiDoc<CheckInAttrs>): string[] {
  const rows = Array.isArray(doc.data) ? doc.data : [doc.data];
  const out: string[] = [];
  for (const r of rows) {
    if (r.type !== 'CheckIn') continue;
    const a = r.attributes;
    if (a.kind && !['Regular', 'Guest'].includes(a.kind)) continue;
    const name = [a.first_name, a.last_name].filter(Boolean).join(' ').trim().replace(/\s+/g, ' ');
    if (name) out.push(name);
  }
  return [...new Set(out)];
}

/** Roster names a set of check-ins covers, matched by full name. */
export function matchRoster(names: string[], roster: { name: string }[]): { matched: string[]; unknown: string[] } {
  const byKey = new Map(roster.map((r) => [key(r.name), r.name]));
  const matched: string[] = [];
  const unknown: string[] = [];
  for (const n of names) {
    const hit = byKey.get(key(n));
    if (hit) matched.push(hit);
    else unknown.push(n);
  }
  return { matched: [...new Set(matched)], unknown };
}
