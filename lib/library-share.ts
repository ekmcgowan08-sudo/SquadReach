/* What may leave the ministry when a unit is shared to the library. Other
   ministries read shared units, so a unit can't name a student, a guardian
   or anyone on the ministry's account list. Checked on the phone before
   sharing and again by the database (library_units_names). */
import type { LibraryUnit, MinistryData } from '@/lib/types/model';

const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}' -]/gu, ' ').replace(/\s+/g, ' ').trim();

/** Full names (two words or more) that appear in the text, as whole words. */
export function namesIn(text: string, names: string[]): string[] {
  const hay = ' ' + words(text) + ' ';
  const out = new Set<string>();
  for (const n of names) {
    const w = words(n);
    if (w.split(' ').length < 2) continue;
    if (hay.includes(' ' + w + ' ')) out.add(n.trim());
  }
  return [...out];
}

/** Everyone the ministry knows by name. */
export function knownNames(d: MinistryData): string[] {
  return [...d.roster.map((r) => r.name), ...Object.values(d.families ?? {}).map((f) => f.guardian), ...(d.people ?? []).map((p) => p.name)].filter(Boolean);
}

export const unitText = (u: Pick<LibraryUnit, 'title' | 'summary' | 'includes' | 'span' | 'theme'>) => [u.title, u.summary, u.span, u.theme, ...u.includes].join(' \n ');

/** The names that would go out with this unit — empty when it may be shared. */
export const shareBlockers = (u: Pick<LibraryUnit, 'title' | 'summary' | 'includes' | 'span' | 'theme'>, d: MinistryData) => namesIn(unitText(u), knownNames(d));
