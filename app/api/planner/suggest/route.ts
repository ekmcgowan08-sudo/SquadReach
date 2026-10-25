/* "Ask Claude for ideas" on the roadmap. Leaders only. With a ministry
   account the plan is read from the database as the signed-in leader; the
   demo sends its plan along, and only when the server opts in. The answer
   is checked (lib/plan-ai) and comes back as suggestions — nothing is added
   to the plan until a leader taps it. */
import Anthropic from '@anthropic-ai/sdk';
import { isoDay } from '@/lib/dates';
import { getCurrentMembership } from '@/lib/get-membership';
import { canApprove } from '@/lib/permissions';
import { cleanIdeas, planBrief } from '@/lib/plan-ai';
import { yearOf, type Plan } from '@/lib/plan';
import { AiDeclined, aiConfigured, askForIdeas } from '@/lib/server/plan-ai';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/* One request per leader at a time, and not more than every 30 seconds. */
const last = new Map<string, number>();
const COOLDOWN = 30_000;

export async function POST(req: Request) {
  const res = await getCurrentMembership();
  const m = res?.membership;
  if (!m) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  if (!canApprove(m.persona)) return Response.json({ error: 'Only leaders plan the teaching.' }, { status: 403 });
  if (!aiConfigured()) return Response.json({ error: 'Ideas from Claude aren’t set up on this server (ANTHROPIC_API_KEY).' }, { status: 503 });

  let plan: Plan | null = null;
  if (m.mode === 'supabase' && m.orgId) {
    const sb = await supabaseServer();
    const r = await sb.from('ministry_docs').select('value').eq('org_id', m.orgId).eq('key', 'plan').maybeSingle();
    plan = (r.data?.value as Plan | undefined) ?? null;
  } else {
    if (process.env.PLANNER_AI_IN_DEMO !== '1') return Response.json({ error: 'Ideas from Claude are off in the demo. A server can turn them on with PLANNER_AI_IN_DEMO=1.' }, { status: 403 });
    const text = await req.text();
    if (text.length > 512_000) return Response.json({ error: 'That plan is too large to send.' }, { status: 413 });
    plan = ((JSON.parse(text || '{}') as { plan?: Plan }).plan ?? null);
  }
  if (!plan?.settings || !Array.isArray(plan.items)) return Response.json({ error: 'There’s no plan to read yet. Set it up first.' }, { status: 400 });

  const who = m.membershipId ?? 'demo:' + m.persona;
  const at = Date.now();
  if (at - (last.get(who) ?? 0) < COOLDOWN) return Response.json({ error: 'Give it half a minute between asks.' }, { status: 429 });
  last.set(who, at);

  try {
    const nowYear = plan.settings.startYear + yearOf(plan, isoDay(new Date()));
    const raw = await askForIdeas(planBrief(plan, nowYear));
    const ideas = cleanIdeas(raw, plan);
    return Response.json({ ideas, dropped: raw.ideas.length - ideas.length });
  } catch (e) {
    if (e instanceof AiDeclined) return Response.json({ error: e.message }, { status: 422 });
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: 'Claude is busy right now. Try again in a minute.' }, { status: 503 });
    if (e instanceof Anthropic.APIError) return Response.json({ error: 'Claude couldn’t be reached (' + (e.status ?? 'network') + ').' }, { status: 502 });
    return Response.json({ error: e instanceof Error ? e.message : 'Something went wrong.' }, { status: 500 });
  }
}
