/* Suggestions written by Claude, held to the planner's AI rules:
   suggest, never act — every idea lands as a dashed draft a leader
   confirms; each cites the passages it relies on, as references only;
   it respects the church's tradition, doctrine and translation; and it
   never invents resources or quotations.

   This module is pure: what Claude is told, the shape it must answer in,
   and the checks every answer passes before a leader sees it. The call
   itself is on the server (lib/server/plan-ai.ts). */
import { z } from 'zod';
import { COVERAGE_CATS, assessCoverage, cohorts, norm } from '@/lib/plan-insights';
import { MONTHS_FROM_AUG, nightsOf, teachingOf, yearLabel, type Plan } from '@/lib/plan';

export const AI_MODEL = 'claude-opus-5-5';

/** What Claude must answer with. Ranges are checked again below. */
export const IdeasSchema = z.object({
  ideas: z.array(
    z.object({
      title: z.string(),
      year: z.number().int(),
      month: z.number().int().nullable(),
      weeks: z.number().int(),
      big_idea: z.string(),
      passages: z.array(z.string()),
      tags: z.array(z.string()),
      reason: z.string()
    })
  )
});
export type RawIdeas = z.infer<typeof IdeasSchema>;

export const SYSTEM = [
  'You help a student ministry plan its teaching across seven years. You suggest teaching series; a leader decides.',
  'Rules you must keep:',
  '- Suggest only. Every idea is a draft for a leader to accept or set aside.',
  '- Cite the passages each series relies on as references only (for example "Romans 8" or "John 3:1–21"). Never quote scripture or any other text.',
  '- Never invent resources, curricula, books, authors, videos or quotations. Suggest the series itself, not materials for it.',
  '- Stay within the church’s stated tradition, doctrine and values. Where they are not stated, stay with what Christians broadly hold in common.',
  '- Fill the gaps the plan shows: years short of teaching weeks, and coverage categories a graduating class would miss. Don’t repeat a series the plan already has.',
  '- Use only the coverage category ids you are given for tags.',
  '- Keep reasons to one or two plain sentences a youth pastor would say out loud.'
].join('\n');

/** The plan, as Claude reads it: the church, each year's teaching, and the
 *  gaps. Names of students never appear — only the plan. */
export function planBrief(p: Plan, nowYear: number, max = 6): string {
  const st = p.settings;
  const sy = st.startYear;
  const years = [0, 1, 2, 3, 4, 5, 6].map((y) => {
    const series = teachingOf(p, y);
    const weeks = series.reduce((n, s) => n + s.size, 0);
    return {
      year: y,
      label: yearLabel(sy, y),
      nights: nightsOf(p, y).length,
      taught_weeks: weeks,
      series: series.map((s) => ({ title: s.title, weeks: s.size, month: s.month === undefined ? null : MONTHS_FROM_AUG[s.month], passages: s.refs || null, tags: s.tags, status: s.status }))
    };
  });
  const gaps: string[] = [];
  for (const c of cohorts(p))
    for (const cat of COVERAGE_CATS) {
      const cell = assessCoverage(p, cat.id, c, nowYear);
      if (cell.status !== 'healthy' && !cell.dismissed) gaps.push('Class of ' + c + ' · ' + cat.id + ': ' + cell.reason);
    }
  const church = {
    tradition: st.tradition || 'Not specified',
    denomination: st.denomination || null,
    translation: st.translation,
    doctrinal_priorities: st.doctrine || null,
    values: st.values || null,
    graduate_outcomes: st.outcomes ?? [],
    church_year: st.liturgical
  };
  return [
    'The church:',
    JSON.stringify(church, null, 1),
    '',
    'Ministry years (year 0 is ' + yearLabel(sy, 0) + '; months run August to July):',
    JSON.stringify(years, null, 1),
    '',
    'Coverage category ids you may tag with:',
    COVERAGE_CATS.map((c) => c.id + ' (' + c.name + ')').join(', '),
    '',
    'Coverage gaps (' + gaps.length + '):',
    gaps.slice(0, 60).join('\n') || 'None.',
    '',
    'Suggest up to ' + max + ' teaching series that fill the biggest gaps, mostly in the next three years. For each: a title, which year (0–6), a starting month index (0 = August … 11 = July) or null, how many weeks (2–12), the big idea in one sentence, the passages it works through, the coverage tags it carries, and why it belongs there.'
  ].join('\n');
}

/** A passage reference: a book (optionally numbered) and a chapter, maybe
 *  verses or a range. "Psalm 23", "1 Corinthians 13:4–7", "Acts 1–2". */
export const REF = /^(?:[1-3] )?[A-Z][a-z]+(?: (?:of )?[A-Z][a-z]+)*\.? \d{1,3}(?::\d{1,3}(?:[–-]\d{1,3})?)?(?:[–-]\d{1,3}(?::\d{1,3})?)?$/;
/** Anything that looks like a quotation of more than a few words. */
export const QUOTE = /["“”‘’][^"“”]{24,}["“”]/;

export interface AiSuggestion {
  id: string;
  year: number;
  lane: 'teach';
  title: string;
  kind: 'series';
  size: number;
  month?: number;
  bigIdea: string;
  reason: string;
  rule: 'claude';
  cites: string[];
  tags: string[];
}

/** Every idea passes these before a leader sees it; one that doesn't is
 *  dropped, never repaired into something Claude didn't say. */
export function cleanIdeas(raw: RawIdeas, p: Plan): AiSuggestion[] {
  const have = new Set(p.items.map((i) => norm(i.title)));
  const known = new Set(COVERAGE_CATS.map((c) => c.id));
  const out: AiSuggestion[] = [];
  for (const i of raw.ideas ?? []) {
    const title = i.title.trim().replace(/\s+/g, ' ');
    if (!title || title.length > 80 || have.has(norm(title))) continue;
    if (!Number.isInteger(i.year) || i.year < 0 || i.year > 6) continue;
    if (!Number.isInteger(i.weeks) || i.weeks < 2 || i.weeks > 12) continue;
    const cites = [...new Set(i.passages.map((x) => x.trim()).filter((x) => REF.test(x)))].slice(0, 8);
    if (!cites.length) continue;
    const text = i.big_idea + ' ' + i.reason;
    if (QUOTE.test(text) || i.big_idea.length > 240 || i.reason.length > 400) continue;
    const month = i.month !== null && Number.isInteger(i.month) && i.month >= 0 && i.month <= 11 ? i.month : undefined;
    have.add(norm(title));
    out.push({ id: 'sug:claude|' + norm(title), year: i.year, lane: 'teach', title, kind: 'series', size: i.weeks, month, bigIdea: i.big_idea.trim(), reason: i.reason.trim(), rule: 'claude', cites, tags: [...new Set(i.tags.filter((t) => known.has(t)))] });
  }
  return out.filter((s) => !p.dismissed.some((d) => d.id === s.id));
}
