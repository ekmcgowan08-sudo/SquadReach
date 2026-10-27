/* "Draft the rules from written material" in Console › Scoring: Claude
   turns a leader's notes (or a rules file) into rules a coach can read
   out, and suggests the game's format. Suggest, never act: the leader
   reads the draft and uses it or not. No quotations, nothing invented
   about equipment or places the notes don't mention.

   Pure: what Claude is told, the shape it answers in, and the checks.
   The call is on the server (lib/server/rules-ai.ts). */
import { z } from 'zod';
import { QUOTE } from '@/lib/plan-ai';
import { ENDS, SCORING, SEGMENTS, formatOf, type GameFormat } from '@/lib/game-format';

export const RulesSchema = z.object({
  title: z.string(),
  rules: z.string(),
  format: z.object({
    segment: z.enum(SEGMENTS.map((s) => s.id) as [GameFormat['segment'], ...GameFormat['segment'][]]),
    count: z.number().int(),
    minutes: z.number().int(),
    ends: z.enum(ENDS.map((e) => e.id) as [GameFormat['ends'], ...GameFormat['ends'][]]),
    scoring: z.enum(SCORING.map((s) => s.id) as [GameFormat['scoring'], ...GameFormat['scoring'][]]),
    to_win: z.number().int().nullable(),
    max_players: z.number().int().nullable()
  })
});
export type RawRules = z.infer<typeof RulesSchema>;

export const RULES_SYSTEM = [
  'You turn a youth pastor’s notes about a game into rules a coach can read out loud to students before it starts.',
  'Rules you must keep:',
  '- Use only what the notes say. Never invent equipment, places, point values or safety claims the notes don’t give; where something is missing, leave it out.',
  '- Plain words, short paragraphs: how it starts, how you score, what gets a penalty, how it ends. No headings, no markdown, no lists of more than six lines.',
  '- Never quote any text.',
  '- Suggest the format the notes describe: rounds, innings, quarters, periods, halves, heats or one continuous game; how many; minutes each; what ends each one; how it is scored; points to win and players on the field if the notes say (null if not).'
].join('\n');

export const rulesBrief = (notes: string, gameName: string) => ['Game: ' + (gameName || 'not named yet'), '', 'The notes:', notes.trim().slice(0, 20_000), '', 'Write the rules and suggest the format.'].join('\n');

export interface RulesDraft {
  title: string;
  rules: string;
  format: GameFormat;
}

/** Null when the draft breaks a rule — never repaired. */
export function cleanRules(raw: RawRules): RulesDraft | null {
  const rules = raw.rules.trim().replace(/\n{3,}/g, '\n\n');
  if (!rules || rules.length > 4000 || QUOTE.test(rules) || /^#|\*\*/m.test(rules)) return null;
  const f = raw.format;
  return {
    title: raw.title.trim().slice(0, 60),
    rules,
    format: formatOf({ segment: f.segment, count: f.count, minutes: f.minutes, ends: f.ends, scoring: f.scoring, toWin: f.to_win && f.to_win > 0 ? f.to_win : null, maxPlayers: f.max_players && f.max_players > 0 ? f.max_players : null })
  };
}
