/* "Draft the rules from written material" in Console › Scoring. Leaders
   only. The notes go to Claude with the game's name; the answer is
   checked (lib/rules-ai) and comes back as a draft. Nothing is saved
   here — the leader uses the draft or doesn't. */
import Anthropic from '@anthropic-ai/sdk';
import { getCurrentMembership } from '@/lib/get-membership';
import { canApprove } from '@/lib/permissions';
import { cleanRules, rulesBrief } from '@/lib/rules-ai';
import { AiDeclined, aiConfigured } from '@/lib/server/plan-ai';
import { askForRules } from '@/lib/server/rules-ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const last = new Map<string, number>();
const COOLDOWN = 30_000;

export async function POST(req: Request) {
  const res = await getCurrentMembership();
  const m = res?.membership;
  if (!m) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  if (!canApprove(m.persona)) return Response.json({ error: 'Only leaders set up the game.' }, { status: 403 });
  if (!aiConfigured()) return Response.json({ error: 'Drafts from Claude aren’t set up on this server (ANTHROPIC_API_KEY).' }, { status: 503 });
  if (m.mode !== 'supabase' && process.env.PLANNER_AI_IN_DEMO !== '1') return Response.json({ error: 'Drafts from Claude are off in the demo. A server can turn them on with PLANNER_AI_IN_DEMO=1.' }, { status: 403 });

  const text = await req.text();
  if (text.length > 64_000) return Response.json({ error: 'Those notes are too long to send. Trim them to the game itself.' }, { status: 413 });
  let body: { notes?: string; gameName?: string };
  try {
    body = JSON.parse(text || '{}');
  } catch {
    return Response.json({ error: 'That request wasn’t readable.' }, { status: 400 });
  }
  const notes = String(body.notes ?? '').trim();
  if (notes.length < 10) return Response.json({ error: 'Add a few lines about how the game works first.' }, { status: 400 });

  const who = m.membershipId ?? 'demo:' + m.persona;
  const at = Date.now();
  if (at - (last.get(who) ?? 0) < COOLDOWN) return Response.json({ error: 'Give it half a minute between drafts.' }, { status: 429 });
  last.set(who, at);

  try {
    const draft = cleanRules(await askForRules(rulesBrief(notes, String(body.gameName ?? '').slice(0, 80))));
    if (!draft) return Response.json({ error: 'The draft broke the rules (a quotation, or formatting). Try again, or write them by hand.' }, { status: 422 });
    return Response.json(draft);
  } catch (e) {
    if (e instanceof AiDeclined) return Response.json({ error: e.message }, { status: 422 });
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: 'Claude is busy right now. Try again in a minute.' }, { status: 503 });
    if (e instanceof Anthropic.APIError) return Response.json({ error: 'Claude couldn’t be reached (' + (e.status ?? 'network') + ').' }, { status: 502 });
    return Response.json({ error: e instanceof Error ? e.message : 'Something went wrong.' }, { status: 500 });
  }
}
