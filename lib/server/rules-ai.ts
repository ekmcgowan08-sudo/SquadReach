import 'server-only';
/* Asking Claude to draft game rules from a leader's notes. One structured
   request; lib/rules-ai checks the answer. If the model declines, a
   fallback model gets the same request (server-side). */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { AI_MODEL } from '@/lib/plan-ai';
import { RULES_SYSTEM, RulesSchema, type RawRules } from '@/lib/rules-ai';
import { AiDeclined } from '@/lib/server/plan-ai';

export async function askForRules(brief: string, client: Anthropic = new Anthropic()): Promise<RawRules> {
  const res = await client.beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaZodOutputFormat(RulesSchema) },
    system: RULES_SYSTEM,
    messages: [{ role: 'user', content: brief }]
  });
  if (res.stop_reason === 'refusal') throw new AiDeclined('Claude declined to draft rules from these notes.');
  if (res.stop_reason === 'max_tokens' || !res.parsed_output) throw new Error('Claude’s answer came back incomplete. Try again.');
  return res.parsed_output;
}
