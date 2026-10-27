/* "Build from this week's lesson" in Console › Small groups. Leaders only.
   The lesson goes to Claude with the room, the minutes and the squads'
   names (never students'); the answer is checked (lib/small-group-ai) and
   comes back as a draft. Nothing is saved here — the leader reviews it
   and saves it from the console. */
import Anthropic from '@anthropic-ai/sdk';
import { getCurrentMembership } from '@/lib/get-membership';
import { canApprove } from '@/lib/permissions';
import { AiDeclined, aiConfigured } from '@/lib/server/plan-ai';
import { askForDraft } from '@/lib/server/small-group-ai';
import { cleanDraft, draftBrief, type DraftInput } from '@/lib/small-group-ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const last = new Map<string, number>();
const COOLDOWN = 30_000;

export async function POST(req: Request) {
  const res = await getCurrentMembership();
  const m = res?.membership;
  if (!m) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  if (!canApprove(m.persona)) return Response.json({ error: 'Only leaders build small groups.' }, { status: 403 });
  if (!aiConfigured()) return Response.json({ error: 'Drafts from Claude aren’t set up on this server (ANTHROPIC_API_KEY).' }, { status: 503 });
  if (m.mode !== 'supabase' && process.env.PLANNER_AI_IN_DEMO !== '1') return Response.json({ error: 'Drafts from Claude are off in the demo. A server can turn them on with PLANNER_AI_IN_DEMO=1.' }, { status: 403 });

  const text = await req.text();
  if (text.length > 64_000) return Response.json({ error: 'That lesson is too long to send. Trim it to the main points.' }, { status: 413 });
  let body: Partial<DraftInput> & { teams?: { id: string; name: string }[] };
  try {
    body = JSON.parse(text || '{}');
  } catch {
    return Response.json({ error: 'That request wasn’t readable.' }, { status: 400 });
  }
  const lesson = String(body.lesson ?? '').trim();
  if (lesson.length < 3) return Response.json({ error: 'Add the lesson, a passage or a topic first.' }, { status: 400 });
  const teams = (Array.isArray(body.teams) ? body.teams : []).filter((t) => t && typeof t.id === 'string' && typeof t.name === 'string').slice(0, 12).map((t) => ({ id: t.id, name: t.name.slice(0, 40) }));
  const input: DraftInput = {
    mode: body.mode === 'passage' || body.mode === 'topic' ? body.mode : 'text',
    lesson,
    minutes: Math.max(10, Math.min(90, Number(body.minutes) || 30)),
    room: String(body.room ?? 'Mixed 6–12').slice(0, 40),
    squads: teams.map((t) => t.name),
    week: Math.max(1, Math.min(52, Number(body.week) || 1)),
    ministry: String(body.ministry ?? '').slice(0, 80) || 'A student ministry',
    tradition: body.tradition ? String(body.tradition).slice(0, 120) : undefined
  };

  const who = m.membershipId ?? 'demo:' + m.persona;
  const at = Date.now();
  if (at - (last.get(who) ?? 0) < COOLDOWN) return Response.json({ error: 'Give it half a minute between drafts.' }, { status: 429 });
  last.set(who, at);

  try {
    const raw = await askForDraft(draftBrief(input));
    return Response.json(cleanDraft(raw, { week: input.week, teams, id: () => crypto.randomUUID() }));
  } catch (e) {
    if (e instanceof AiDeclined) return Response.json({ error: e.message }, { status: 422 });
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: 'Claude is busy right now. Try again in a minute.' }, { status: 503 });
    if (e instanceof Anthropic.APIError) return Response.json({ error: 'Claude couldn’t be reached (' + (e.status ?? 'network') + ').' }, { status: 502 });
    return Response.json({ error: e instanceof Error ? e.message : 'Something went wrong.' }, { status: 500 });
  }
}
