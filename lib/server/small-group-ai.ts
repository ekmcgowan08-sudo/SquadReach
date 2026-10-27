import 'server-only';
/* Asking Claude to draft a small-group guide from the week's lesson. One
   structured request; lib/small-group-ai checks the answer before a leader
   sees it. If the model declines, a fallback model gets the same request
   (server-side). */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { AI_MODEL } from '@/lib/plan-ai';
import { DraftSchema, SG_SYSTEM, type RawDraft } from '@/lib/small-group-ai';
import { AiDeclined } from '@/lib/server/plan-ai';

export async function askForDraft(brief: string, client: Anthropic = new Anthropic()): Promise<RawDraft> {
  const res = await client.beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: betaZodOutputFormat(DraftSchema) },
    system: SG_SYSTEM,
    messages: [{ role: 'user', content: brief }]
  });
  if (res.stop_reason === 'refusal') throw new AiDeclined('Claude declined to draft from this lesson.');
  if (res.stop_reason === 'max_tokens' || !res.parsed_output) throw new Error('Claude’s answer came back incomplete. Try again.');
  return res.parsed_output;
}
