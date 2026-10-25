import 'server-only';
/* Asking Claude for teaching-series ideas. One structured request; the
   answer is checked by lib/plan-ai before anyone sees it. If the model
   declines, a fallback model gets the same request (server-side). */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { AI_MODEL, IdeasSchema, SYSTEM, type RawIdeas } from '@/lib/plan-ai';

export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

/** Claude (and its fallback) declined: say so rather than guess. */
export class AiDeclined extends Error {}

export async function askForIdeas(brief: string, client: Anthropic = new Anthropic()): Promise<RawIdeas> {
  const res = await client.beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: betaZodOutputFormat(IdeasSchema) },
    system: SYSTEM,
    messages: [{ role: 'user', content: brief }]
  });
  if (res.stop_reason === 'refusal') throw new AiDeclined('Claude declined to suggest anything for this plan.');
  if (res.stop_reason === 'max_tokens' || !res.parsed_output) throw new Error('Claude’s answer came back incomplete. Try again.');
  return res.parsed_output;
}
