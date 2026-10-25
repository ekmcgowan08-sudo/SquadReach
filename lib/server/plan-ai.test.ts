import { describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { AiDeclined, askForIdeas } from '@/lib/server/plan-ai';

/* A stand-in for the SDK client: records the request, returns a canned reply. */
const fake = (reply: Record<string, unknown>) => {
  const seen: Record<string, unknown>[] = [];
  const client = { beta: { messages: { parse: async (params: Record<string, unknown>) => (seen.push(params), reply) } } } as unknown as Anthropic;
  return { client, seen };
};

describe('asking Claude for ideas', () => {
  it('asks the current Opus with a server-side fallback and a schema, at medium effort', async () => {
    const { client, seen } = fake({ stop_reason: 'end_turn', parsed_output: { ideas: [] } });
    expect(await askForIdeas('the plan', client)).toEqual({ ideas: [] });
    const p = seen[0] as { model: string; fallbacks: string; betas: string[]; output_config: { effort: string; format: { type: string } }; messages: { content: string }[] };
    expect(p.model).toBe('claude-opus-5-5');
    expect(p.fallbacks).toBe('default');
    expect(p.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(p.output_config.effort).toBe('medium');
    expect(p.output_config.format.type).toBe('json_schema');
    expect(p.messages[0].content).toBe('the plan');
  });

  it('says so when Claude declines, rather than inventing anything', async () => {
    const { client } = fake({ stop_reason: 'refusal', parsed_output: null });
    await expect(askForIdeas('x', client)).rejects.toBeInstanceOf(AiDeclined);
  });

  it('treats a cut-off answer as a failure', async () => {
    const { client } = fake({ stop_reason: 'max_tokens', parsed_output: null });
    await expect(askForIdeas('x', client)).rejects.toThrow(/incomplete/);
  });
});
