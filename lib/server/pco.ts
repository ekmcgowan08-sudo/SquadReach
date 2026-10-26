import 'server-only';
/* Planning Center, on the server. Each ministry connects its own Planning
   Center account by OAuth; the tokens live in pco_connections, which only
   the service role reads, and are refreshed here before they run out. The
   app reads people (to import a roster) and check-ins (to take attendance);
   it never writes to Planning Center.

   Needs PCO_CLIENT_ID and PCO_CLIENT_SECRET (an OAuth app registered at
   api.planningcenteronline.com/oauth/applications) and the service key. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkInNames, peopleFrom, type CheckInDoc, type PcoPerson } from '@/lib/pco';
import { serviceClient } from '@/lib/server/deliveries';

export const PCO_API = 'https://api.planningcenteronline.com';
export const PCO_SCOPES = 'people check_ins';
/** Pages read per request, so a huge database can't run away with a call. */
const MAX_PAGES = 20;

export interface PcoDeps {
  fetch: typeof fetch;
  db: SupabaseClient;
  now: () => number;
  clientId: string;
  clientSecret: string;
}

export const pcoConfigured = () => !!(process.env.PCO_CLIENT_ID && process.env.PCO_CLIENT_SECRET);

export function realPcoDeps(): PcoDeps | null {
  const db = serviceClient();
  if (!db || !pcoConfigured()) return null;
  return { fetch, db, now: Date.now, clientId: process.env.PCO_CLIENT_ID!, clientSecret: process.env.PCO_CLIENT_SECRET! };
}

export class PcoError extends Error {
  constructor(
    message: string,
    readonly status = 502
  ) {
    super(message);
  }
}

export function authorizeUrl(clientId: string, redirect: string, state: string) {
  const u = new URL(PCO_API + '/oauth/authorize');
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirect);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', PCO_SCOPES);
  u.searchParams.set('state', state);
  return u.toString();
}

interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
}

async function tokens(deps: PcoDeps, body: Record<string, string>): Promise<Tokens> {
  const r = await deps.fetch(PCO_API + '/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ...body, client_id: deps.clientId, client_secret: deps.clientSecret })
  });
  const j = (await r.json().catch(() => ({}))) as Partial<Tokens> & { error_description?: string; error?: string };
  if (!r.ok || !j.access_token || !j.refresh_token) throw new PcoError('Planning Center didn’t accept that: ' + (j.error_description ?? j.error ?? 'answered ' + r.status) + '.', r.status === 401 ? 401 : 502);
  return j as Tokens;
}

const expiry = (deps: PcoDeps, t: Tokens) => new Date(deps.now() + Math.max(60, t.expires_in) * 1000).toISOString();

/** Finishes the OAuth round trip: trades the code for tokens, names the
 *  Planning Center organization, and stores the connection. */
export async function connect(deps: PcoDeps, orgId: string, code: string, redirect: string, by: string | null): Promise<{ org: string }> {
  const t = await tokens(deps, { grant_type: 'authorization_code', code, redirect_uri: redirect });
  const who = await deps.fetch(PCO_API + '/people/v2', { headers: { Authorization: 'Bearer ' + t.access_token, Accept: 'application/json' } });
  const org = who.ok ? (((await who.json()) as { data?: { attributes?: { name?: string } } }).data?.attributes?.name ?? '') : '';
  const r = await deps.db.from('pco_connections').upsert({
    org_id: orgId,
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: expiry(deps, t),
    scope: t.scope ?? PCO_SCOPES,
    pco_org_name: org,
    connected_by: by,
    connected_at: new Date(deps.now()).toISOString()
  });
  if (r.error) throw new PcoError(r.error.message, 500);
  return { org };
}

export async function disconnect(deps: PcoDeps, orgId: string) {
  const r = await deps.db.from('pco_connections').delete().eq('org_id', orgId);
  if (r.error) throw new PcoError(r.error.message, 500);
}

interface Conn {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

async function refresh(deps: PcoDeps, orgId: string, c: Conn): Promise<string> {
  const t = await tokens(deps, { grant_type: 'refresh_token', refresh_token: c.refresh_token });
  const r = await deps.db.from('pco_connections').update({ access_token: t.access_token, refresh_token: t.refresh_token, expires_at: expiry(deps, t) }).eq('org_id', orgId);
  if (r.error) throw new PcoError(r.error.message, 500);
  return t.access_token;
}

/** A current access token, refreshed when it's within a minute of expiry. */
async function access(deps: PcoDeps, orgId: string): Promise<{ token: string; conn: Conn }> {
  const r = await deps.db.from('pco_connections').select('access_token, refresh_token, expires_at').eq('org_id', orgId).maybeSingle();
  if (r.error) throw new PcoError(r.error.message, 500);
  const conn = r.data as Conn | null;
  if (!conn) throw new PcoError('Planning Center isn’t connected for this ministry.', 409);
  const fresh = Date.parse(conn.expires_at) - 60_000 > deps.now();
  return { token: fresh ? conn.access_token : await refresh(deps, orgId, conn), conn };
}

/** Every page of a list endpoint, following links.next. */
async function pages<T>(deps: PcoDeps, orgId: string, first: string, keep: (doc: T) => boolean = () => true): Promise<T[]> {
  let { token, conn } = await access(deps, orgId);
  const out: T[] = [];
  let url: string | undefined = first.startsWith('http') ? first : PCO_API + first;
  let retried = false;
  for (let i = 0; url && i < MAX_PAGES; i++) {
    const r = await deps.fetch(url, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
    if (r.status === 401 && !retried) {
      /* Revoked or expired early: refresh once and try the same page again. */
      retried = true;
      token = await refresh(deps, orgId, conn);
      conn = { ...conn, access_token: token };
      i--;
      continue;
    }
    if (!r.ok) throw new PcoError(r.status === 401 ? 'Planning Center turned the connection down. Connect it again.' : 'Planning Center answered ' + r.status + '.', r.status === 401 ? 401 : 502);
    const doc = (await r.json()) as T & { links?: { next?: string } };
    out.push(doc);
    if (!keep(doc)) break;
    url = doc.links?.next;
  }
  return out;
}

/** People, from everyone or from one Planning Center list. */
export async function pcoPeople(deps: PcoDeps, orgId: string, listId?: string): Promise<PcoPerson[]> {
  const path = listId ? '/people/v2/lists/' + encodeURIComponent(listId) + '/people?per_page=100' : '/people/v2/people?per_page=100&order=last_name';
  const docs = await pages<Parameters<typeof peopleFrom>[0]>(deps, orgId, path);
  return docs.flatMap((d) => peopleFrom(d));
}

export async function pcoLists(deps: PcoDeps, orgId: string): Promise<{ id: string; name: string }[]> {
  const docs = await pages<{ data: { id: string; attributes: { name?: string } }[] }>(deps, orgId, '/people/v2/lists?per_page=100&order=name');
  return docs.flatMap((d) => d.data.map((l) => ({ id: l.id, name: l.attributes.name ?? 'Untitled list' })));
}

/** Names checked in between two instants, newest first until before `from`. */
export async function pcoCheckIns(deps: PcoDeps, orgId: string, from: string, to: string): Promise<string[]> {
  const t0 = Date.parse(from);
  const t1 = Date.parse(to);
  const docs = await pages<CheckInDoc>(deps, orgId, '/check-ins/v2/check_ins?per_page=100&order=-created_at', (d) => d.data.every((c) => Date.parse(c.attributes.created_at ?? '') >= t0));
  const inRange = docs.map((d) => ({ ...d, data: d.data.filter((c) => {
    const t = Date.parse(c.attributes.created_at ?? '');
    return t >= t0 && t < t1;
  }) }));
  return [...new Set(inRange.flatMap((d) => checkInNames(d)))];
}
